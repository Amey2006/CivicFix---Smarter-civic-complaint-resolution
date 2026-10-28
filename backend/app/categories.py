"""Issue categories and the category-specific report fields stored in MongoDB.
The frontend renders the dynamic report form from this definition."""

CATEGORIES: dict[str, dict] = {
    "pothole": {
        "label": "Pothole",
        "department": "ROADS",
        "icon": "construction",
        "color": "#f97316",
        "fields": [
            {"name": "size", "label": "Approximate size", "type": "select",
             "options": ["Small (< 30 cm)", "Medium (30 cm - 1 m)", "Large (> 1 m)"]},
            {"name": "depth", "label": "Depth", "type": "select",
             "options": ["Shallow", "Moderate", "Deep / dangerous"]},
            {"name": "traffic", "label": "Traffic on road", "type": "select",
             "options": ["Low", "Moderate", "Heavy"]},
            {"name": "caused_accident", "label": "Has it caused an accident?", "type": "checkbox"},
        ],
    },
    "streetlight": {
        "label": "Streetlight",
        "department": "ELEC",
        "icon": "lightbulb",
        "color": "#eab308",
        "fields": [
            {"name": "pole_number", "label": "Pole number (if visible)", "type": "text"},
            {"name": "issue", "label": "Problem", "type": "select",
             "options": ["Not working", "Flickering", "On during daytime", "Damaged pole", "Exposed wiring"]},
            {"name": "lights_affected", "label": "Number of lights affected", "type": "number"},
        ],
    },
    "water_leak": {
        "label": "Water Leakage",
        "department": "WATER",
        "icon": "droplets",
        "color": "#0ea5e9",
        "fields": [
            {"name": "source", "label": "Leak source", "type": "select",
             "options": ["Main pipeline", "House connection", "Public tap", "Valve / meter", "Unknown"]},
            {"name": "flow", "label": "Flow rate", "type": "select",
             "options": ["Dripping", "Steady stream", "Gushing / burst"]},
            {"name": "contaminated", "label": "Water looks contaminated", "type": "checkbox"},
        ],
    },
    "garbage": {
        "label": "Garbage",
        "department": "SANI",
        "icon": "trash",
        "color": "#22c55e",
        "fields": [
            {"name": "waste_type", "label": "Type of waste", "type": "select",
             "options": ["Household", "Construction debris", "Plastic", "Medical / hazardous", "Mixed"]},
            {"name": "volume", "label": "Volume", "type": "select",
             "options": ["A few bags", "Small heap", "Large dump"]},
            {"name": "days_pending", "label": "Days uncollected", "type": "number"},
        ],
    },
    "drainage": {
        "label": "Drainage",
        "department": "SANI",
        "icon": "waves",
        "color": "#8b5cf6",
        "fields": [
            {"name": "problem", "label": "Problem", "type": "select",
             "options": ["Blocked drain", "Overflowing sewer", "Open manhole", "Foul smell"]},
            {"name": "flooding", "label": "Causing waterlogging", "type": "checkbox"},
        ],
    },
    "other": {
        "label": "Other",
        "department": "GEN",
        "icon": "circle-help",
        "color": "#64748b",
        "fields": [
            {"name": "details", "label": "Additional details", "type": "text"},
        ],
    },
}

PRIORITIES = ["low", "medium", "high", "critical"]

ESCALATION_LEVELS = {
    1: "Department Head",
    2: "Municipal Commissioner",
    3: "Mayor's Office",
}
MAX_ESCALATION = max(ESCALATION_LEVELS)
