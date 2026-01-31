export const EVENT_MAP = {
    // ON STAGE
    "QIRAATH": "On Stage",
    "DEBATE MALAYALAM": "On Stage",
    "SPEECH MALAYALAM": "On Stage",
    "SPEECH ENGLISH": "On Stage",
    "SPEECH ARABIC": "On Stage",
    "SPEECH URDU": "On Stage",
    "THINK TALK": "On Stage",
    "SATIRICAL TALK MALAYALAM": "On Stage",
    "ENCOUNTER": "On Stage",
    "ROLE PLAY": "On Stage",
    "SPOT TRANSLATION (A-M)": "On Stage",
    "SPOT TRANSLATION (E-M)": "On Stage",
    "SPELLING BEE": "On Stage",
    "QUIZ": "On Stage",
    "SONG MALAYALAM": "On Stage",
    "SONG ARABIC": "On Stage",
    "TABLE TALK URDU": "On Stage",
    "INSPIRING TALK ARABIC": "On Stage",
    "INSPIRING TALK ENGLISH": "On Stage",
    "MASHUP": "On Stage",
    "SHOW YOUR POTENTIAL": "On Stage",
    "MIME": "On Stage",

    // OFF STAGE
    "BOOK REVIEW MALAYALAM": "Off Stage",
    "EPIC STUDY": "Off Stage",
    "ESSAY ARABIC": "Off Stage",
    "ESSAY ENGLISH": "Off Stage",
    "ESSAY MALAYALAM": "Off Stage",
    "ESSAY URDU": "Off Stage",
    "MINI STORY MALAYALAM": "Off Stage",
    "POEM ARABIC": "Off Stage",
    "POEM ENGLISH": "Off Stage",
    "POEM MALAYALAM": "Off Stage",
    "REPORT ARABIC": "Off Stage",
    "REPORT ENGLISH": "Off Stage",
    "REPORT MALAYALAM": "Off Stage",
    "SUMMARIZATION (MAL)": "Off Stage",
    "SHORT VLOGGING ENGLISH": "Off Stage",
    "SONG WRITING": "Off Stage",
    "STORY ARABIC": "Off Stage",
    "STORY ENGLISH": "Off Stage",
    "STORY MALAYALAM": "Off Stage",
    "STORY URDU": "Off Stage",
    "TRANSLATION (A-M)": "Off Stage",
    "TRANSLATION (E-M)": "Off Stage",
    "CARTOON": "Off Stage",
    "DEFEND & OFFEND": "Off Stage",
    "PHOTO FEATURE": "Off Stage",
    "Q AND H PAINTING": "Off Stage",
    "BROCHURE MAKING": "Off Stage",
    "PROJECT SUBMISSION": "Off Stage",
    "REEL MAKING": "Off Stage",
    "AI VIDEO CREATION": "Off Stage",
    "TRENT SETTING": "Off Stage",
    "PAINTING": "Off Stage"
};

export const GENERAL_LIST = [
    "MASHUP", "MIME",
    "BROCHURE MAKING", "PROJECT SUBMISSION", "REEL MAKING",
    "AI VIDEO CREATION", "TRENT SETTING"
];

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

export default ALL_EVENTS;
