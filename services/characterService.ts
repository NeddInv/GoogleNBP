import { CharacterProfile } from '../types';

export const DEFAULT_CHARACTERS: CharacterProfile[] = [
    {
        id: 'char_joyce',
        name: 'Joyce',
        ethnicity: 'Black / African American',
        genderAge: 'Older woman in her 60s',
        skinTone: 'Deep rich brown skin tone with authentic melanin complexion',
        distinguishingFeatures: 'Natural textured graying hair, African American facial structure, warm expressive eyes',
        wardrobeNotes: 'Orange knit cardigan over shirt, holding paper shopping bags',
        isLocked: true
    },
    {
        id: 'char_rosa',
        name: 'Rosa',
        ethnicity: 'Latina / Hispanic',
        genderAge: 'Woman in her late 30s to 40s',
        skinTone: 'Warm olive / medium golden tan skin tone',
        distinguishingFeatures: 'Dark brown wavy shoulder-length hair, athletic active build',
        wardrobeNotes: 'Navy quilted down vest over cream knit sweater, khaki shorts, white athletic sneakers',
        isLocked: true
    },
    {
        id: 'char_marcus',
        name: 'Marcus',
        ethnicity: 'Black / African American',
        genderAge: 'Athletic man in his early 30s',
        skinTone: 'Rich dark chocolate melanin complexion',
        distinguishingFeatures: 'Short athletic fade haircut, well-groomed beard, athletic build',
        wardrobeNotes: 'Athletic compression gear, technical knee sleeve, running shoes',
        isLocked: true
    }
];

const STORAGE_KEY = 'adgen_character_profiles';

/**
 * Loads character profiles from localStorage with defaults.
 */
export const loadCharacterProfiles = (): CharacterProfile[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_CHARACTERS;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CHARACTERS;
        
        // Ensure default key characters like Joyce remain present if user hasn't deliberately removed them
        const hasJoyce = parsed.some(c => c.name.toLowerCase() === 'joyce');
        if (!hasJoyce) {
            return [...DEFAULT_CHARACTERS.filter(c => c.name.toLowerCase() === 'joyce'), ...parsed];
        }
        return parsed;
    } catch {
        return DEFAULT_CHARACTERS;
    }
};

/**
 * Saves character profiles to localStorage.
 */
export const saveCharacterProfiles = (profiles: CharacterProfile[]): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (err) {
        console.error('Failed to save character profiles to localStorage', err);
    }
};

/**
 * Detects which characters from the character cast are mentioned or referenced.
 */
export const detectActiveCharacters = (
    corpus: string[],
    characters?: CharacterProfile[]
): CharacterProfile[] => {
    const list = characters && characters.length > 0 ? characters : loadCharacterProfiles();
    const joinedCorpus = corpus.filter(Boolean).join(' ').toLowerCase();

    return list.filter(char => {
        if (!char.isLocked) return false;
        const pattern = new RegExp(`\\b${char.name.toLowerCase()}\\b`, 'i');
        return pattern.test(joinedCorpus);
    });
};

/**
 * Generates prompt directives enforcing demographic and ethnicity fidelity for detected characters.
 */
export const generateCharacterDirectives = (activeCharacters: CharacterProfile[]): string => {
    if (!activeCharacters || activeCharacters.length === 0) return '';

    return [
        '=== CRITICAL CHARACTER ETHNICITY & RACIAL FIDELITY MANDATE (UNIVERSAL DEMOGRAPHIC LOCK) ===',
        'You MUST strictly preserve the demographic identity, racial heritage, skin tone, and physical appearance of each named character in this scene with ZERO whitewashing or race alteration:',
        ...activeCharacters.map((char, i) => {
            const isPoc = /black|african|latino|latina|hispanic|asian|indigenous|middle eastern|brown|dark skin/i.test(
                `${char.ethnicity} ${char.skinTone || ''}`
            );

            return [
                `• CHARACTER #${i + 1}: "${char.name.toUpperCase()}"`,
                `  - ETHNICITY & RACE: ${char.ethnicity}${char.genderAge ? ` (${char.genderAge})` : ''}`,
                `  - SKIN COMPLEXION: ${char.skinTone || 'Authentic true-to-life ethnic skin tone and melanin richness'}`,
                char.distinguishingFeatures ? `  - FACIAL & HAIR FEATURES: ${char.distinguishingFeatures}` : '',
                char.wardrobeNotes ? `  - WARDROBE & STYLING: ${char.wardrobeNotes}` : '',
                `  - STRICT ZERO-WHITEWASHING RULE: You are strictly PROHIBITED from depicting "${char.name}" as ${isPoc ? 'Caucasian, white, fair-skinned, pale, or ethnically ambiguous. Their skin tone and facial structure MUST authentically reflect ' + char.ethnicity : 'having their established identity or race altered'}.`
            ].filter(Boolean).join('\n');
        })
    ].join('\n');
};

/**
 * Generates negative prompt tokens to prevent whitewashing or ethnic distortion.
 */
export const generateCharacterNegativeTerms = (activeCharacters: CharacterProfile[]): string => {
    if (!activeCharacters || activeCharacters.length === 0) return '';

    const tokens: string[] = [];

    activeCharacters.forEach(char => {
        const isPoc = /black|african|latino|latina|hispanic|asian|indigenous|middle eastern|brown|dark skin/i.test(
            `${char.ethnicity} ${char.skinTone || ''}`
        );

        if (isPoc) {
            tokens.push(
                `Caucasian ${char.name}`,
                `white ${char.name}`,
                `fair skin ${char.name}`,
                `light skin ${char.name}`,
                `pale ${char.name}`,
                `whitewashed ${char.name}`,
                `race change ${char.name}`,
                `altered ethnicity ${char.name}`
            );
        } else {
            tokens.push(`altered ethnicity ${char.name}`, `wrong race ${char.name}`);
        }
    });

    tokens.push('whitewashed characters', 'altered ethnicity', 'race swap', 'ethnicity change');

    return Array.from(new Set(tokens)).join(', ');
};

export interface ParsedSwapIntent<T extends { name: string; category?: string } = { name: string; category?: string }> {
    swapKind: 'character' | 'object';
    targetSceneEntry: T;
    sourceSubjectEntry: T;
    targetSubjectDesc: string;
    sourceSubjectDesc: string;
    outfitDirective: 'keep-scene-outfit' | 'keep-source-outfit' | 'harmonize';
}

/**
 * Resolves a token (filename or @name) to a matching photo entry using strict priority:
 * 1. Exact full filename match
 * 2. Exact basename match (without extension)
 * 3. Best/longest partial match (avoids short names hijacking longer filenames)
 */
function resolveEntryToken<T extends { name: string }>(token: string, entries: T[]): T | undefined {
    const clean = token.trim().replace(/^@/, '').replace(/^["'\[\]]+|["'\[\]]+$/g, '').trim();
    if (!clean) return undefined;
    const cleanLower = clean.toLowerCase();
    const cleanBase = cleanLower.replace(/\.[^/.]+$/, '');

    const exactFull = entries.find(e => e.name.toLowerCase() === cleanLower);
    if (exactFull) return exactFull;

    const exactBase = entries.find(e => e.name.toLowerCase().replace(/\.[^/.]+$/, '') === cleanBase);
    if (exactBase) return exactBase;

    if (cleanBase.length >= 4) {
        const containsMatches = entries
            .filter(e => e.name.toLowerCase().includes(cleanBase))
            .sort((a, b) => a.name.length - b.name.length);
        if (containsMatches.length > 0) return containsMatches[0];
    }

    const reverseMatches = entries
        .filter(e => {
            const eb = e.name.toLowerCase().replace(/\.[^/.]+$/, '');
            return eb.length >= 4 && cleanBase.includes(eb);
        })
        .sort((a, b) => b.name.length - a.name.length);
    return reverseMatches[0];
}

/**
 * Detects character/person OR product/object swap commands in natural language prompts, e.g.:
 * - "Replace bottle in @scene.png with @my_bottle.png"  -> swapKind: 'object'
 * - "Replace woman in @Frame-03.png with woman in @frame-01N.webp" -> swapKind: 'character'
 * - "Put @product.png into @scene.png replacing the old product" -> swapKind: 'object'
 */
export function parseCharacterSwapPrompt<T extends { name: string; category?: string }>(
    promptText: string,
    entries: T[]
): ParsedSwapIntent<T> | null {
    if (!promptText || !entries || entries.length < 2) return null;

    const text = promptText.trim();
    const hasSwapVerb = /\b(replace|swap|switch|change|substitute|put|place|insert)\b/i.test(text);
    if (!hasSwapVerb) return null;

    let targetToken = '';
    let sourceToken = '';
    let targetDesc = '';
    let sourceDesc = '';

    // Pattern 1: Replace/Swap/Change [targetDesc] in/on/from @TargetPhoto with/for/to ([sourceDesc] in/from/of)? @SourcePhoto
    const p1 = text.match(
        /\b(?:replace|swap|switch|change|substitute)\s+(?:the\s+)?([^@\n]+?)\s+(?:in|on|from)\s+(@?[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]{2,5}|@[a-zA-Z0-9_\-\.]+)\s+(?:with|for|to|by)\s+(?:(?:the\s+)?([^@\n]+?)\s+(?:in|from|of)\s+)?(@?[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]{2,5}|@[a-zA-Z0-9_\-\.]+)/i
    );
    if (p1) {
        targetDesc = p1[1].trim();
        targetToken = p1[2].trim();
        if (p1[3]) sourceDesc = p1[3].trim();
        sourceToken = p1[4].trim();
    }

    // Pattern 2: Replace/Swap (@TargetPhoto) with (@SourcePhoto)
    if (!targetToken || !sourceToken) {
        const p2 = text.match(
            /\b(?:replace|swap|switch|change|substitute)\s+(?:(?:the\s+)?([^@\n]+?)\s+)?(@[a-zA-Z0-9_\-\.]+|[a-zA-Z0-9_\-\.]+\.(?:png|jpe?g|webp|gif))\s+(?:with|for|to|by)\s+(?:(?:the\s+)?([^@\n]+?)\s+(?:in|from|of)?\s*)?(@[a-zA-Z0-9_\-\.]+|[a-zA-Z0-9_\-\.]+\.(?:png|jpe?g|webp|gif))/i
        );
        if (p2) {
            if (p2[1]) targetDesc = p2[1].trim();
            targetToken = p2[2].trim();
            if (p2[3]) sourceDesc = p2[3].trim();
            sourceToken = p2[4].trim();
        }
    }

    // Pattern 3: Put/Place/Insert [sourceDesc] from/in @SourcePhoto into/in @TargetPhoto (replacing [targetDesc])?
    if (!targetToken || !sourceToken) {
        const p3 = text.match(
            /\b(?:put|place|insert)\s+(?:(?:the\s+)?([^@\n]+?)\s+(?:in|from|of)\s+)?(@[a-zA-Z0-9_\-\.]+|[a-zA-Z0-9_\-\.]+\.(?:png|jpe?g|webp|gif))\s+(?:into|inside|in|onto|on)\s+(@[a-zA-Z0-9_\-\.]+|[a-zA-Z0-9_\-\.]+\.(?:png|jpe?g|webp|gif))(?:\s*(?:,|and)?\s*(?:replacing|instead of|in place of)\s+(?:the\s+)?([^,\.\n]+))?/i
        );
        if (p3) {
            if (p3[1]) sourceDesc = p3[1].trim();
            sourceToken = p3[2].trim();
            targetToken = p3[3].trim();
            if (p3[4]) targetDesc = p3[4].trim();
        }
    }

    if (!targetToken || !sourceToken) return null;

    const targetEntry = resolveEntryToken(targetToken, entries);
    const sourceEntry = resolveEntryToken(sourceToken, entries);
    if (!targetEntry || !sourceEntry || targetEntry.name.toLowerCase() === sourceEntry.name.toLowerCase()) {
        return null;
    }

    // Determine whether this swap is about a PERSON/CHARACTER vs a PRODUCT/OBJECT
    const descCorpus = `${targetDesc} ${sourceDesc}`.toLowerCase();
    const personWordRegex = /\b(woman|man|person|girl|boy|model|character|lady|guy|dude|athlete|runner|face|head|actor|talent|human|someone|people|she|he|her|him|joyce|rosa|marcus)\b/i;
    const productWordRegex = /\b(product|bottle|can|box|pack|package|packaging|jar|tube|pouch|bag|sleeve|knee|brace|shoe|sneaker|item|object|logo|label|device|gadget|tool|cream|serum|supplement|container|cup|mug|watch|phone|shirt|jacket|hat|prop|gear|apparel|drink|snack|supplement)\b/i;

    const sourceCat = (sourceEntry.category || '').toLowerCase();
    const isSourceProductCategory = sourceCat.includes('product') || sourceCat.includes('apparel') || sourceCat.includes('gear') || sourceCat.includes('competitor') || sourceCat.includes('logo');
    const isSourceModelCategory = sourceCat.includes('model') || sourceCat.includes('character');

    let swapKind: 'character' | 'object' = 'object';
    if (productWordRegex.test(descCorpus) || (isSourceProductCategory && !personWordRegex.test(descCorpus))) {
        swapKind = 'object';
    } else if (personWordRegex.test(descCorpus) || isSourceModelCategory) {
        swapKind = 'character';
    } else {
        swapKind = 'object';
    }

    const cleanTargetDesc = targetDesc.replace(/^(?:the|a|an)\s+/i, '').trim() || (swapKind === 'character' ? 'person' : 'product');
    const cleanSourceDesc = sourceDesc.replace(/^(?:the|a|an)\s+/i, '').trim() || (swapKind === 'character' ? 'person' : 'product');

    let outfitDirective: 'keep-scene-outfit' | 'keep-source-outfit' | 'harmonize' = 'harmonize';
    if (/keep\s+(?:the\s+)?(?:original\s+|scene\s+|target\s+)?(?:outfit|clothes|clothing|wardrobe|dress|cardigan|shirt)/i.test(text) || /same\s+(?:outfit|clothes|clothing)/i.test(text)) {
        outfitDirective = 'keep-scene-outfit';
    } else if (/wear(?:ing)?\s+(?:the\s+)?(?:outfit|clothes|clothing)\s+from/i.test(text) || /keep\s+(?:her|his|their)\s+(?:outfit|clothes)/i.test(text)) {
        outfitDirective = 'keep-source-outfit';
    }

    return {
        swapKind,
        targetSceneEntry: targetEntry,
        sourceSubjectEntry: sourceEntry,
        targetSubjectDesc: cleanTargetDesc,
        sourceSubjectDesc: cleanSourceDesc,
        outfitDirective
    };
}


