import React from 'react';
import { observer } from 'mobx-react-lite';
import './market-analyzer.scss';

const MarketAnalyzer = observer(() => {
    return (
        <div className='market-analyzer'>
            <div className='market-analyzer__iframe-container'>
                <iframe
                    src='https://frostytraders.vercel.app/'
                    className='market-analyzer__iframe'
                    title='Market Analyzer'
                    allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                    allowFullScreen
                />
            </div>
        </div>
    );
});

export default MarketAnalyzer;
