
import React from 'react';
import type { PanDirection, VaryStrength, ZoomLevel } from '../types';
import { UpscaleIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon } from './icons';

interface CreationActionsProps {
    disabled: boolean;
    onVary: (strength: VaryStrength) => void;
    onZoomIn: (level: ZoomLevel) => void;
    onZoomOut: () => void;
    onUpscale: () => void;
    onPan: (direction: PanDirection) => void;
}

const ActionButton: React.FC<{
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
    className?: string;
    ariaLabel?: string;
}> = ({ onClick, disabled, children, className = '', ariaLabel }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-center bg-brand-primary hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

const IconButton: React.FC<{
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
    ariaLabel: string;
}> = ({ onClick, disabled, children, ariaLabel }) => (
     <button
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className="p-2 text-sm font-medium rounded-lg transition-all duration-200 text-center bg-brand-primary hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {children}
    </button>
);


export const CreationActions: React.FC<CreationActionsProps> = ({
    disabled, onVary, onZoomIn, onZoomOut, onUpscale, onPan
}) => {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-brand-accent">Creation Actions</h3>
            <div className="space-y-3">
                <div className="grid grid-cols-[100px,1fr] items-center gap-x-4">
                    <span className="font-medium text-brand-light text-sm text-right">Vary</span>
                    <div className="flex gap-2">
                        <ActionButton onClick={() => onVary('subtle')} disabled={disabled}>Subtle</ActionButton>
                        <ActionButton onClick={() => onVary('strong')} disabled={disabled}>Strong</ActionButton>
                    </div>
                </div>
                <div className="grid grid-cols-[100px,1fr] items-center gap-x-4">
                    <span className="font-medium text-brand-light text-sm text-right">Zoom</span>
                    <div className="flex gap-2">
                        <ActionButton onClick={() => onZoomIn('1.5x')} disabled={disabled}>1.5x</ActionButton>
                        <ActionButton onClick={() => onZoomIn('2x')} disabled={disabled}>2x</ActionButton>
                         <ActionButton onClick={onZoomOut} disabled={disabled}>Out</ActionButton>
                    </div>
                </div>
                 <div className="grid grid-cols-[100px,1fr] items-center gap-x-4">
                    <span className="font-medium text-brand-light text-sm text-right">More options</span>
                    <div className="flex gap-2">
                        <ActionButton onClick={onUpscale} disabled={disabled}>Upscale</ActionButton>
                    </div>
                </div>
                 <div className="grid grid-cols-[100px,1fr] items-center gap-x-4">
                    <span className="font-medium text-brand-light text-sm text-right">Pan</span>
                    <div className="flex gap-2">
                        <IconButton onClick={() => onPan('up')} disabled={disabled} ariaLabel="Pan up"><ArrowUpIcon className="w-5 h-5" /></IconButton>
                        <IconButton onClick={() => onPan('down')} disabled={disabled} ariaLabel="Pan down"><ArrowDownIcon className="w-5 h-5" /></IconButton>
                        <IconButton onClick={() => onPan('left')} disabled={disabled} ariaLabel="Pan left"><ArrowLeftIcon className="w-5 h-5" /></IconButton>
                        <IconButton onClick={() => onPan('right')} disabled={disabled} ariaLabel="Pan right"><ArrowRightIcon className="w-5 h-5" /></IconButton>
                    </div>
                </div>
            </div>
        </div>
    );
};
