export const EVENT_MAP = {
    // Junior ONLY (On Stage)
    "WORD WAR ARABIC": "On Stage",
    "WORD WAR ENGLISH": "On Stage",
    "REACTING": "On Stage",
    "TABLE TALK ARABIC": "On Stage",
    "GENIUS PROFILE": "On Stage",
    "DISCUSSION ENGLISH": "On Stage",
    "LISTENING ARABIC": "On Stage",
    "IDEAL TALK": "On Stage",
    "C-TALK HINDI": "On Stage",

    // Senior ONLY (On Stage)
    "SPEECH URDU": "On Stage",
    "PRODUCT MARKETING": "On Stage",
    "SATIRICAL TALK MALAYALAM": "On Stage",
    "ENCOUNTER": "On Stage",
    "PRESS CONFERENCE": "On Stage",
    "INSPIRING TALK ENGLISH": "On Stage",
    "SPOT TRANSLATION (A-E)": "On Stage",
    "BOOK DEFENCE": "On Stage",
    "SONG ARABIC": "On Stage",
    "MAPPILA SONG": "On Stage",
    "TABLE TALK URDU": "On Stage",
    "PROFESSIONAL INTERVIEW": "On Stage",
    "SELF BRANDING": "On Stage",
    "PANEL DISCUSSION": "On Stage",
    "SPIRITUAL TALK ARABIC": "On Stage",

    // Common Junior & Senior (On Stage)
    "QIRATH": "On Stage",
    "SPEECH MALAYALAM": "On Stage",
    "SPEECH ARABIC": "On Stage",
    "SPEECH ENGLISH": "On Stage",
    "DEBATE": "On Stage",
    "SPELLING BEE": "On Stage",
    "SONG MALAYALAM": "On Stage",
    "MASTER HUNT": "On Stage",

    // Junior ONLY (Off Stage)
    "URDU READING": "Off Stage",
    "PROBLEM SOLVING": "Off Stage",
    "PHOTOGRAPHY": "Off Stage",
    "MINI STORY MALAYALAM": "Off Stage",

    // Senior ONLY (Off Stage)
    "ESSAY URDU": "Off Stage",
    "STORY URDU": "Off Stage",
    "REPORT WRITING ARABIC": "Off Stage",
    "TRANSLATION ENGLISH-MALAYALAM": "Off Stage",
    "TRANSLATION ARABIC-MALAYALAM": "Off Stage",
    "TRANSLATION URDU-MALAYALAM": "Off Stage",
    "MINI STORY": "Off Stage",
    "EPIC STUDY": "Off Stage",

    // Common Junior & Senior (Off Stage)
    "ESSAY MALAYALAM": "Off Stage",
    "ESSAY ARABIC": "Off Stage",
    "ESSAY ENGLISH": "Off Stage",
    "POEM MALAYALAM": "Off Stage",
    "POEM ARABIC": "Off Stage",
    "POEM ENGLISH": "Off Stage",
    "STORY MALAYALAM": "Off Stage",
    "STORY ARABIC": "Off Stage",
    "STORY ENGLISH": "Off Stage",
    "CALLIGRAPHY": "Off Stage",
    "REPORT WRITING MALAYALAM": "Off Stage",
    "REPORT WRITING ENGLISH": "Off Stage",
    "CARTOON DRAWING": "Off Stage",
    "Q & H PAINTING": "Off Stage",
    "SHORT VLOGGING": "Off Stage",
    "DIGITAL DESIGNING": "Off Stage",

    // General (On Stage)
    "MASH UP": "General",
    "SHOW YOUR POTENTIAL": "General",
    "PADALUM PARACHILUM": "General",
    "ROLE PLAY": "General",
    "TED X TALK": "General",
    "TREND SETTING": "General",

    // General (Off Stage)
    "PHOTO FEATURE": "General",
    "COLLAGE": "General",
    "ESCAPE ROOM": "General",
    "AMBIENCE SETTING": "General",
    "AI VIDEO CREATION": "General",
    "MORAL VIDEO CREATION": "General",
    "DIGITAL MAGAZINE": "General",
    "PROJECT SUBMISSION": "General"
};

export const GENERAL_LIST = [
    // General On Stage
    "MASH UP",
    "SHOW YOUR POTENTIAL",
    "PADALUM PARACHILUM",
    "ROLE PLAY",
    "TED X TALK",
    "TREND SETTING",

    // General Off Stage
    "PHOTO FEATURE",
    "COLLAGE",
    "ESCAPE ROOM",
    "AMBIENCE SETTING",
    "AI VIDEO CREATION",
    "MORAL VIDEO CREATION",
    "DIGITAL MAGAZINE",
    "PROJECT SUBMISSION"
];

export const GENERAL_SUBTYPE_MAP = {
    // General On Stage
    "MASH UP": "On Stage",
    "SHOW YOUR POTENTIAL": "On Stage",
    "PADALUM PARACHILUM": "On Stage",
    "ROLE PLAY": "On Stage",
    "TED X TALK": "On Stage",
    "TREND SETTING": "On Stage",

    // General Off Stage
    "PHOTO FEATURE": "Off Stage",
    "COLLAGE": "Off Stage",
    "ESCAPE ROOM": "Off Stage",
    "AMBIENCE SETTING": "Off Stage",
    "AI VIDEO CREATION": "Off Stage",
    "MORAL VIDEO CREATION": "Off Stage",
    "DIGITAL MAGAZINE": "Off Stage",
    "PROJECT SUBMISSION": "Off Stage"
};

export const EVENT_SCOPE_MAP = {
    // Junior ONLY
    "URDU READING": "Junior",
    "PROBLEM SOLVING": "Junior",
    "PHOTOGRAPHY": "Junior",
    "MINI STORY MALAYALAM": "Junior",
    "WORD WAR ARABIC": "Junior",
    "WORD WAR ENGLISH": "Junior",
    "REACTING": "Junior",
    "TABLE TALK ARABIC": "Junior",
    "GENIUS PROFILE": "Junior",
    "DISCUSSION ENGLISH": "Junior",
    "LISTENING ARABIC": "Junior",
    "IDEAL TALK": "Junior",
    "C-TALK HINDI": "Junior",

    // Senior ONLY
    "ESSAY URDU": "Senior",
    "STORY URDU": "Senior",
    "REPORT WRITING ARABIC": "Senior",
    "TRANSLATION ENGLISH-MALAYALAM": "Senior",
    "TRANSLATION ARABIC-MALAYALAM": "Senior",
    "TRANSLATION URDU-MALAYALAM": "Senior",
    "MINI STORY": "Senior",
    "EPIC STUDY": "Senior",
    "SPEECH URDU": "Senior",
    "PRODUCT MARKETING": "Senior",
    "SATIRICAL TALK MALAYALAM": "Senior",
    "ENCOUNTER": "Senior",
    "PRESS CONFERENCE": "Senior",
    "INSPIRING TALK ENGLISH": "Senior",
    "SPOT TRANSLATION (A-E)": "Senior",
    "BOOK DEFENCE": "Senior",
    "SONG ARABIC": "Senior",
    "MAPPILA SONG": "Senior",
    "TABLE TALK URDU": "Senior",
    "PROFESSIONAL INTERVIEW": "Senior",
    "SELF BRANDING": "Senior",
    "PANEL DISCUSSION": "Senior",
    "SPIRITUAL TALK ARABIC": "Senior"
};

export const ALL_EVENTS = Object.keys(EVENT_MAP);

export const ON_STAGE_EVENTS = ALL_EVENTS.filter(evt => EVENT_MAP[evt] === "On Stage" || (EVENT_MAP[evt] === "General" && GENERAL_SUBTYPE_MAP[evt] === "On Stage"));
export const OFF_STAGE_EVENTS = ALL_EVENTS.filter(evt => EVENT_MAP[evt] === "Off Stage" || (EVENT_MAP[evt] === "General" && GENERAL_SUBTYPE_MAP[evt] === "Off Stage"));
export const GENERAL_EVENTS = ALL_EVENTS.filter(evt => GENERAL_LIST.includes(evt.toUpperCase()));

export const getEventType = (eventName) => {
    if (!eventName) return "Unknown";
    const name = eventName.trim().toUpperCase();
    if (EVENT_MAP[name]) return EVENT_MAP[name];
    if (GENERAL_LIST.includes(name)) return "General";
    return "Unknown";
};

export const getGeneralSubtype = (eventName) => {
    if (!eventName) return "Off Stage";
    const name = eventName.trim().toUpperCase();
    return GENERAL_SUBTYPE_MAP[name] || "Off Stage";
};

export const isGeneralEvent = (eventName) => {
    if (!eventName) return false;
    return GENERAL_LIST.includes(eventName.trim().toUpperCase());
};

export const getEventScope = (eventName) => {
    if (!eventName) return "Common/General";
    const name = eventName.trim().toUpperCase();
    if (GENERAL_LIST.includes(name)) return "Common/General";
    return EVENT_SCOPE_MAP[name] || "Junior & Senior";
};

export default ALL_EVENTS;
