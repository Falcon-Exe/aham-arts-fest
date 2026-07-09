export const EVENT_MAP = {
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
    "PHOTO FEATURE",
    "COLLAGE",
    "ESCAPE ROOM",
    "AMBIENCE SETTING",
    "AI VIDEO CREATION",
    "MORAL VIDEO CREATION",
    "DIGITAL MAGAZINE",
    "PROJECT SUBMISSION"
];

export const EVENT_SCOPE_MAP = {
    // Junior ONLY
    "URDU READING": "Junior",
    "PROBLEM SOLVING": "Junior",
    "PHOTOGRAPHY": "Junior",
    "MINI STORY MALAYALAM": "Junior",

    // Senior ONLY
    "ESSAY URDU": "Senior",
    "STORY URDU": "Senior",
    "REPORT WRITING ARABIC": "Senior",
    "TRANSLATION ENGLISH-MALAYALAM": "Senior",
    "TRANSLATION ARABIC-MALAYALAM": "Senior",
    "TRANSLATION URDU-MALAYALAM": "Senior",
    "MINI STORY": "Senior",
    "EPIC STUDY": "Senior"
};

export const ALL_EVENTS = Object.keys(EVENT_MAP);

export const ON_STAGE_EVENTS = ALL_EVENTS.filter(evt => EVENT_MAP[evt] === "On Stage");
export const OFF_STAGE_EVENTS = ALL_EVENTS.filter(evt => EVENT_MAP[evt] === "Off Stage");
export const GENERAL_EVENTS = ALL_EVENTS.filter(evt => GENERAL_LIST.includes(evt.toUpperCase()));

export const getEventType = (eventName) => {
    if (!eventName) return "Unknown";
    const name = eventName.trim().toUpperCase();
    if (EVENT_MAP[name]) return EVENT_MAP[name];
    if (GENERAL_LIST.includes(name)) return "General";
    return "Unknown";
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
