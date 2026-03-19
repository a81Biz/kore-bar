export const UIRules = {
    'form-piso-zona': {
        // Note: Callbacks like loadZones() should be triggered by the view after success
    },
    'form-piso-mesa': {
        // ID of the select to keep intact after submit
        preserveFields: ['mesa-zona']
    }
};
