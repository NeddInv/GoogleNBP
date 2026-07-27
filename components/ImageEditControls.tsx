
import React from 'react';
import type { PanDirection, ZoomDirection } from '../types';
import { UpscaleIcon, ZoomInIcon, ZoomOutIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon } from './icons';

interface ImageEditControlsProps {
    onUpscale: () => void;
    onPan: (direction: PanDirection) => void;
    onZoom: (direction: ZoomDirection) => void;
}

const ControlButton: React.FC<{
    onClick: () => void;
    ariaLabel: string;
    children: React.ReactNode;
    className?: string;
}> = ({ onClick, ariaLabel, children, className = '' }) => (
    <button
        onClick={onClick}
        aria-label={ariaLabel}
        className={`p-2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-md transition-all backdrop-blur-sm ${className}`}
    >
        {children}
    </button>
);

export const ImageEditControls: React.FC<ImageEditControlsProps> = ({ onUpscale, onPan, onZoom }) => {
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <div className="flex items-center gap-2 p-1 bg-black bg-opacity-30 backdrop-blur-md rounded-lg">
                {/* Pan Controls */}
                <div className="relative">
                    <ControlButton onClick={() => onPan('up')} ariaLabel="Pan up" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1"><ArrowUpIcon className="w-5 h-5" /></ControlButton>
                    <ControlButton onClick={() => onPan('left')} ariaLabel="Pan left"><ArrowLeftIcon className="w-5 h-5" /></ControlButton>
                    <ControlButton onClick={() => onPan('right')} ariaLabel="Pan right"><ArrowRightIcon className="w-5 h-5" /></ControlButton>
                    <ControlButton onClick={() => onPan('down')} ariaLabel="Pan down" className="absolute top-full left-1/2 -translate-x-1/2 mt-1"><ArrowDownIcon className="w-5 h-5" /></ControlButton>
                </div>

                {/* Main Controls */}
                <ControlButton onClick={onUpscale} ariaLabel="Upscale image" className="p-3 bg-indigo-600 hover:bg-indigo-500">
                    <UpscaleIcon className="w-6 h-6" />
                </ControlButton>

                {/* Zoom Controls */}
                <div className="flex flex-col gap-1">
                    <ControlButton onClick={() => onZoom('in')} ariaLabel="Zoom in"><ZoomInIcon className="w-5 h-5" /></ControlButton>
                    <ControlButton onClick={() => onZoom('out')} ariaLabel="Zoom out"><ZoomOutIcon className="w-5 h-5" /></ControlButton>
                </div>
            </div>
        </div>
    );
};
