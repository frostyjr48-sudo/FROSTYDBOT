import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import { useStore } from '@/hooks/useStore';
import {
    ActiveSymbolsRequest,
    ServerTimeRequest,
    TicksHistoryResponse,
    TicksStreamRequest,
    TradingTimesRequest,
} from '@deriv/api-types';
import { ChartTitle, SmartChart } from '@deriv/deriv-charts';
import { useDevice } from '@deriv-com/ui';
import ToolbarWidgets from './toolbar-widgets';
import '@deriv/deriv-charts/dist/smartcharts.css';

type TSubscription = {
    [key: string]: null | {
        unsubscribe?: () => void;
    };
};

type TError = null | {
    error?: {
        code?: string;
        message?: string;
    };
};

const subscriptions: TSubscription = {};

// Default symbol shown before the workspace/active_symbols resolve
const DEFAULT_SYMBOL = '1HZ10V'; // Volatility 10 (1s) Index

/**
 * Returns a ready chart_api instance (readyState OPEN).
 * Waits up to `timeout` ms for the WebSocket to connect.
 * Falls back to returning the api even if still connecting so
 * DerivAPIBasic can queue the request internally.
 */
const waitForChartApi = (timeout = 10000): Promise<NonNullable<typeof chart_api.api>> => {
    return new Promise((resolve, reject) => {
        const start = Date.now();

        const check = async () => {
            if (!chart_api.api) {
                await chart_api.init();
            }
            if (chart_api.api?.connection?.readyState === WebSocket.OPEN) {
                return resolve(chart_api.api);
            }
            if (Date.now() - start > timeout) {
                // Return api anyway — DerivAPIBasic queues sends until the socket opens
                return chart_api.api ? resolve(chart_api.api) : reject(new Error('Chart API timeout'));
            }
            setTimeout(check, 100);
        };

        check();
    });
};

const Chart = observer(({ show_digits_stats }: { show_digits_stats: boolean }) => {
    const barriers: [] = [];
    const { common, ui } = useStore();
    const { chart_store, run_panel, dashboard } = useStore();
    const [isSafari, setIsSafari] = useState(false);
    const [is_connection_opened, setIsConnectionOpened] = useState(false);

    const {
        chart_type,
        getMarketsOrder,
        granularity,
        onSymbolChange,
        setChartStatus,
        symbol,
        updateChartType,
        updateGranularity,
        updateSymbol,
        setChartSubscriptionId,
        chart_subscription_id,
    } = chart_store;
    const chartSubscriptionIdRef = useRef(chart_subscription_id);
    const { isDesktop, isMobile } = useDevice();
    const { is_drawer_open } = run_panel;
    const { is_chart_modal_visible } = dashboard;
    const settings = {
        assetInformation: false, // ui.is_chart_asset_info_visible,
        countdown: true,
        isHighestLowestMarkerEnabled: false, // TODO: Pending UI,
        language: common.current_language.toLowerCase(),
        position: ui.is_chart_layout_default ? 'bottom' : 'left',
        theme: ui.is_dark_mode_on ? 'dark' : 'light',
    };

    useEffect(() => {
        const isSafariBrowser = () => {
            const ua = navigator.userAgent.toLowerCase();
            return ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1 && ua.indexOf('android') === -1;
        };
        setIsSafari(isSafariBrowser());

        return () => {
            if (chart_api.api) chart_api.api.forgetAll('ticks');
        };
    }, []);

    // Track connection state for SmartChart's isConnectionOpened prop (used for reconnections)
    useEffect(() => {
        let cancelled = false;

        const poll = () => {
            if (cancelled) return;
            if (chart_api.api?.connection?.readyState === WebSocket.OPEN) {
                setIsConnectionOpened(true);
            } else {
                setTimeout(poll, 200);
            }
        };

        // Ensure chart_api is initialised, then start polling
        if (!chart_api.api) {
            chart_api.init().then(poll);
        } else {
            poll();
        }

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        chartSubscriptionIdRef.current = chart_subscription_id;
    }, [chart_subscription_id]);

    // Keep retrying updateSymbol until the workspace or active_symbols provide one
    useEffect(() => {
        updateSymbol();
        if (!symbol) {
            const retry = setInterval(() => {
                updateSymbol();
            }, 500);
            return () => clearInterval(retry);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol]);

    // requestAPI waits for the connection internally — SmartChart shows its own loading
    // UI while we wait, so the user always sees something rather than a blank screen.
    const requestAPI = async (req: ServerTimeRequest | ActiveSymbolsRequest | TradingTimesRequest) => {
        const api = await waitForChartApi();
        return api.send(req);
    };

    const requestForgetStream = (subscription_id: string) => {
        if (subscription_id) chart_api.api?.forget(subscription_id);
    };

    const requestSubscribe = async (req: TicksStreamRequest, callback: (data: any) => void) => {
        try {
            requestForgetStream(chartSubscriptionIdRef.current);

            const api = await waitForChartApi();

            // Clear stale server-side tick subscriptions to avoid AlreadySubscribed errors
            try { await api.send({ forget_all: 'ticks' }); } catch { /* non-fatal */ }

            const history = await api.send(req);
            setChartSubscriptionId(history?.subscription.id);
            if (history) callback(history);
            if (req.subscribe === 1) {
                subscriptions[history?.subscription.id] = api
                    .onMessage()
                    ?.subscribe(({ data }: { data: TicksHistoryResponse }) => {
                        callback(data);
                    });
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            (e as TError)?.error?.code === 'MarketIsClosed' && callback([]);
            console.log((e as TError)?.error?.message);
        }
    };

    // Use a safe default symbol so SmartChart always renders and shows its loading UI.
    // The real symbol will arrive from the workspace or active_symbols shortly after mount.
    const active_symbol = symbol || DEFAULT_SYMBOL;

    return (
        <div
            className={classNames('dashboard__chart-wrapper', {
                'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                'dashboard__chart-wrapper--safari': isSafari,
            })}
            dir='ltr'
        >
            <SmartChart
                id='dbot'
                barriers={barriers}
                showLastDigitStats={show_digits_stats}
                chartControlsWidgets={null}
                enabledChartFooter={false}
                chartStatusListener={(v: boolean) => setChartStatus(!v)}
                toolbarWidget={() => (
                    <ToolbarWidgets
                        updateChartType={updateChartType}
                        updateGranularity={updateGranularity}
                        position={!isDesktop ? 'bottom' : 'top'}
                        isDesktop={isDesktop}
                    />
                )}
                chartType={chart_type}
                isMobile={isMobile}
                enabledNavigationWidget={isDesktop}
                granularity={granularity}
                requestAPI={requestAPI}
                requestForget={() => {}}
                requestForgetStream={requestForgetStream}
                requestSubscribe={requestSubscribe}
                settings={settings}
                symbol={active_symbol}
                topWidgets={() => <ChartTitle onChange={onSymbolChange} />}
                isConnectionOpened={is_connection_opened}
                getMarketsOrder={getMarketsOrder}
                isLive
                leftMargin={80}
            />
        </div>
    );
});

export default Chart;
