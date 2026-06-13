import React from 'react';
import { observer } from 'mobx-react-lite';
import './d-circles.scss';

const DCircles = observer(() => {
    return (
        <div className='d-circles'>
            <div className='d-circles__iframe-container'>
                <iframe
                    src='https://frostydcircles.vercel.app/'
                    className='d-circles__iframe'
                    title='D-Circles'
                    allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                    allowFullScreen
                />
            </div>
        </div>
    );
});

export default DCircles;
