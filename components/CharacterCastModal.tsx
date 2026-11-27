import React, { useState } from 'react';
import type { CharacterProfile } from '../types';
import { CloseIcon, UserIcon, CheckIcon, TrashIcon, SparklesIcon, PencilIcon } from './icons';
import { DEFAULT_CHARACTERS } from '../services/characterService';

export interface CharacterCastModalProps {
    isOpen: boolean;
    onClose: () => void;
    characters: CharacterProfile[];
    onSaveCharacters: (characters: CharacterProfile[]) => void;
}

const COMMON_ETHNICITIES = [
    'Black / African American',
    'Latina / Hispanic',
    'East Asian',
    'South Asian',
    'Middle Eastern',
    'Indigenous / Native American',
    'Multiracial / Afro-Latino',
    'Caucasian'
];

const COMMON_SKIN_TONES = [
    'Authentic deep brown skin tone with rich melanin',
    'Rich dark chocolate melanin complexion',
    'Warm golden brown / amber melanin tone',
    'Warm olive / medium tan complexion',
    'Fair skin with neutral undertones'
];

export const CharacterCastModal: React.FC<CharacterCastModalProps> = ({
    isOpen,
    onClose,
    characters,
    onSaveCharacters
}) => {
    const [editingChar, setEditingChar] = useState<CharacterProfile | null>(null);
    const [isCreating, setIsCreating] = useState<boolean>(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formEthnicity, setFormEthnicity] = useState(COMMON_ETHNICITIES[0]);
    const [formGenderAge, setFormGenderAge] = useState('');
    const [formSkinTone, setFormSkinTone] = useState(COMMON_SKIN_TONES[0]);
    const [formFeatures, setFormFeatures] = useState('');
    const [formWardrobe, setFormWardrobe] = useState('');
    const [formIsLocked, setFormIsLocked] = useState(true);

    if (!isOpen) return null;

    const handleStartCreate = () => {
        setEditingChar(null);
        setFormName('');
        setFormEthnicity(COMMON_ETHNICITIES[0]);
        setFormGenderAge('');
        setFormSkinTone(COMMON_SKIN_TONES[0]);
        setFormFeatures('');
        setFormWardrobe('');
        setFormIsLocked(true);
        setIsCreating(true);
    };

    const handleStartEdit = (char: CharacterProfile) => {
        setEditingChar(char);
        setFormName(char.name);
        setFormEthnicity(char.ethnicity);
        setFormGenderAge(char.genderAge || '');
        setFormSkinTone(char.skinTone || COMMON_SKIN_TONES[0]);
        setFormFeatures(char.distinguishingFeatures || '');
        setFormWardrobe(char.wardrobeNotes || '');
        setFormIsLocked(char.isLocked);
        setIsCreating(true);
    };

    const handleSaveForm = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = formName.trim();
        if (!trimmedName) return;

        if (editingChar) {
            const updated = characters.map(c => {
                if (c.id === editingChar.id) {
                    return {
                        ...c,
                        name: trimmedName,
                        ethnicity: formEthnicity.trim(),
                        genderAge: formGenderAge.trim() || undefined,
                        skinTone: formSkinTone.trim() || undefined,
                        distinguishingFeatures: formFeatures.trim() || undefined,
                        wardrobeNotes: formWardrobe.trim() || undefined,
                        isLocked: formIsLocked
                    };
                }
                return c;
            });
            onSaveCharacters(updated);
        } else {
            const newChar: CharacterProfile = {
                id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: trimmedName,
                ethnicity: formEthnicity.trim(),
                genderAge: formGenderAge.trim() || undefined,
                skinTone: formSkinTone.trim() || undefined,
                distinguishingFeatures: formFeatures.trim() || undefined,
                wardrobeNotes: formWardrobe.trim() || undefined,
                isLocked: formIsLocked
            };
            onSaveCharacters([...characters, newChar]);
        }

        setIsCreating(false);
        setEditingChar(null);
    };

    const handleDelete = (id: string) => {
        const filtered = characters.filter(c => c.id !== id);
        onSaveCharacters(filtered);
    };

    const handleToggleLock = (id: string) => {
        const updated = characters.map(c => {
            if (c.id === id) {
                return { ...c, isLocked: !c.isLocked };
            }
            return c;
        });
        onSaveCharacters(updated);
    };

    const handleResetDefaults = () => {
        if (window.confirm('Reset character cast back to defaults (Joyce, Rosa, Marcus)?')) {
            onSaveCharacters(DEFAULT_CHARACTERS);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-2xl bg-[#131127] border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-950/40 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-black/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <UserIcon className="w-5 h-5 text-amber-400" />
                        </span>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <span>Character Cast & Demographic Identity Grounding</span>
                            </h2>
                            <p className="text-xs text-gray-400">
                                Lock racial identity, skin tone & zero-whitewashing rules for any character across all prompts.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                    {!isCreating ? (
                        <>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-gray-300">
                                    Configured Characters ({characters.length})
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleResetDefaults}
                                        className="px-2.5 py-1 text-[11px] text-gray-400 hover:text-gray-200 border border-white/10 hover:border-white/20 rounded-lg transition-colors"
                                    >
                                        Reset Defaults
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleStartCreate}
                                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    >
                                        <span>+ Add Character</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {characters.map((char) => (
                                    <div
                                        key={char.id}
                                        className={`p-3.5 rounded-xl border transition-all ${
                                            char.isLocked 
                                                ? 'bg-black/40 border-amber-500/40 shadow-sm' 
                                                : 'bg-black/20 border-white/5 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/30 to-purple-600/30 border border-amber-400/40 flex items-center justify-center font-bold text-amber-200 text-sm shrink-0">
                                                    {char.name[0]?.toUpperCase() || 'C'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-bold text-white text-sm">{char.name}</h3>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                                            {char.ethnicity}
                                                        </span>
                                                        {char.isLocked ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-semibold">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                                Demographic Lock Active
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-gray-800 text-gray-400 border border-gray-700">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>

                                                    {char.skinTone && (
                                                        <p className="text-[11px] text-amber-200/90 mt-1">
                                                            <strong className="text-gray-400">Skin Tone:</strong> {char.skinTone}
                                                        </p>
                                                    )}
                                                    {char.genderAge && (
                                                        <p className="text-[11px] text-gray-300 mt-0.5">
                                                            <strong className="text-gray-400">Age & Role:</strong> {char.genderAge}
                                                        </p>
                                                    )}
                                                    {char.distinguishingFeatures && (
                                                        <p className="text-[11px] text-gray-300 mt-0.5">
                                                            <strong className="text-gray-400">Features:</strong> {char.distinguishingFeatures}
                                                        </p>
                                                    )}
                                                    {char.wardrobeNotes && (
                                                        <p className="text-[11px] text-gray-300 mt-0.5">
                                                            <strong className="text-gray-400">Wardrobe:</strong> {char.wardrobeNotes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleLock(char.id)}
                                                    title={char.isLocked ? "Disable lock" : "Enable lock"}
                                                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                                        char.isLocked 
                                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' 
                                                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    {char.isLocked ? 'Locked' : 'Unlock'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEdit(char)}
                                                    title="Edit Character"
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                                >
                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(char.id)}
                                                    title="Delete Character"
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleSaveForm} className="space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <SparklesIcon className="w-4 h-4 text-amber-400" />
                                    <span>{editingChar ? `Edit Character: ${editingChar.name}` : 'Add New Character to Cast'}</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => { setIsCreating(false); setEditingChar(null); }}
                                    className="text-xs text-gray-400 hover:text-gray-200"
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                                        Character Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Joyce, Rosa, Marcus, Kofi..."
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                                        Ethnicity / Heritage *
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            required
                                            list="ethnicity-suggestions"
                                            placeholder="e.g. Black / African American"
                                            value={formEthnicity}
                                            onChange={(e) => setFormEthnicity(e.target.value)}
                                            className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                                        />
                                        <datalist id="ethnicity-suggestions">
                                            {COMMON_ETHNICITIES.map(eth => (
                                                <option key={eth} value={eth} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                                    Skin Tone & Melanin Complexion
                                </label>
                                <input
                                    type="text"
                                    list="skintone-suggestions"
                                    placeholder="e.g. Deep brown skin tone with rich melanin"
                                    value={formSkinTone}
                                    onChange={(e) => setFormSkinTone(e.target.value)}
                                    className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                                />
                                <datalist id="skintone-suggestions">
                                    {COMMON_SKIN_TONES.map(st => (
                                        <option key={st} value={st} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                                        Age & Role
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Older woman in her 60s, athletic runner in 30s"
                                        value={formGenderAge}
                                        onChange={(e) => setFormGenderAge(e.target.value)}
                                        className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                                        Distinguishing Facial & Hair Features
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Natural textured graying hair, African American facial structure"
                                        value={formFeatures}
                                        onChange={(e) => setFormFeatures(e.target.value)}
                                        className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                                    Wardrobe & Styling Notes (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Orange knit cardigan over white shirt, paper shopping bags"
                                    value={formWardrobe}
                                    onChange={(e) => setFormWardrobe(e.target.value)}
                                    className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-between border-t border-white/10">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={formIsLocked}
                                        onChange={(e) => setFormIsLocked(e.target.checked)}
                                        className="rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500"
                                    />
                                    <span>Lock Identity & Strictly Enforce Anti-Whitewashing</span>
                                </label>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setIsCreating(false); setEditingChar(null); }}
                                        className="px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all shadow-md shadow-amber-500/20 active:scale-95"
                                    >
                                        {editingChar ? 'Save Changes' : 'Add Character'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Auto-detects names typed in prompt boxes and injects demographic locks.
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
