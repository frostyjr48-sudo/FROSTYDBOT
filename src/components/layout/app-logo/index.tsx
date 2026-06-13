import { useDevice } from '@deriv-com/ui';
import './app-logo.scss';

export const AppLogo = () => {
    const { isDesktop } = useDevice();

    if (!isDesktop) return null;
    return (
        <div className='app-header__logo'>
            <img
                src='/frosty-traders-logo.jpeg'
                alt='FrostyTraders'
                className='app-header__logo-img'
            />
        </div>
    );
};
