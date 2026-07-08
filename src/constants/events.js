export const EVENT_MAP = {
    // ON STAGE (Add your on-stage events here)
    
    // OFF STAGE - JUNIOR & SENIOR (Common)
    "ESSAY MALAYALAM": "Off Stage",
    "ESSAY ARABIC": "Off Stage",
    "ESSAY ENGLISH": "Off Stage",
    "POEM MALAYALAM": "Off Stage",
    "POEM ENGLISH": "Off Stage",
    "POEM ARABIC": "Off Stage",
    "STORY MALAYALAM": "Off Stage",
    "STORY ARABIC": "Off Stage",
    "STORY ENGLISH": "Off Stage",
    "MINI STORY MALAYALAM": "Off Stage",
    "MINI STORY ENGLISH": "Off Stage",
    "REPORT MALAYALAM": "Off Stage",
    "REPORT ENGLISH": "Off Stage",
    "REPORT ARABIC": "Off Stage",
    "CARTOON": "Off Stage",
    "Q AND H PAINTING": "Off Stage",
    "SHORT VLOGGING": "Off Stage",
    "DIGITAL DESIGNING": "Off Stage",
    "CALLIGRAPHY": "Off Stage",

    // OFF STAGE - JUNIOR ONLY
    "PHOTOGRAPHY": "Off Stage",
    "BOOK REVIEW MALAYALAM": "Off Stage",
    "URDU READING": "Off Stage",

    // OFF STAGE - SENIOR ONLY
    "ESSAY URDU": "Off Stage",
    "STORY URDU": "Off Stage",
    "DEFENSE & OFFENSE": "Off Stage",
    "TRANSLATION (A-M)": "Off Stage",
    "TRANSLATION (E-M)": "Off Stage",
    "TRANSLATION (U-M)": "Off Stage",
    "EPIC STUDY": "Off Stage"
};

export const GENERAL_LIST = [
    // Add any events that do NOT have Junior/Senior distinction here
];

export const EVENT_SCOPE_MAP = {
    // JUNIOR ONLY
    "PHOTOGRAPHY": "Junior",
    "BOOK REVIEW MALAYALAM": "Junior",
    "URDU READING": "Junior",
    
    // SENIOR ONLY
    "ESSAY URDU": "Senior",
    "STORY URDU": "Senior",
    "DEFENSE & OFFENSE": "Senior",
    "TRANSLATION (A-M)": "Senior",
    "TRANSLATION (E-M)": "Senior",
    "TRANSLATION (U-M)": "Senior",
    "EPIC STUDY": "Senior"
};

export const ALL_EVENTS = Object.keys(EVENT_MAP);

export const ON_STAGE_EVENTS = ALL_EVENTS.filter(evt => EVENT_MAP[evt] === "On Stage");
export const OFF_STAGE_EVENTS = ALL_EVENTS.filter(evt => EVENT_MAP[evt] === "Off Stage");
export const GENERAL_EVENTS = ALL_EVENTS.filter(evt => GENERAL_LIST.includes(evt.toUpperCase()));

export const getEventType = (eventName) => {
    if (!eventName) return "Unknown";
    return EVENT_MAP[eventName.trim().toUpperCase()] || "Unknown";
};

export const isGeneralEvent = (eventName) => {
    if (!eventName) return false;
    return GENERAL_LIST.includes(eventName.trim().toUpperCase());
};

export const getEventScope = (eventName) => {
    if (!eventName) return "General";
    const name = eventName.trim().toUpperCase();
    if (GENERAL_LIST.includes(name)) return "General";
    return EVENT_SCOPE_MAP[name] || "Junior & Senior";
};

export default ALL_EVENTS;
