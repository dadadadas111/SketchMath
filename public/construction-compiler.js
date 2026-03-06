(function() {
    /**
     * Validates an array of GeoGebra command strings.
     * @param {string[]} commands - Array of command strings.
     * @returns {Object} { valid, errors, warnings, cleanedCommands }
     */
    function validate(commands) {
        var result = {
            valid: true,
            errors: [],
            warnings: [],
            cleanedCommands: []
        };

        if (!Array.isArray(commands)) {
            result.errors.push("Commands must be an array.");
            result.valid = false;
            return result;
        }

        var definedVariables = {};

        for (var i = 0; i < commands.length; i++) {
            var cmd = commands[i];
            if (typeof cmd !== 'string' || cmd.trim() === '') {
                result.errors.push("Command at index " + i + " is empty or not a string.");
                result.valid = false;
                continue;
            }

            var cleanedCmd = cmd.trim();
            result.cleanedCommands.push(cleanedCmd);

            var openParens = (cleanedCmd.match(/\(/g) || []).length;
            var closeParens = (cleanedCmd.match(/\)/g) || []).length;
            if (openParens !== closeParens) {
                result.errors.push("Mismatched parentheses in command: '" + cleanedCmd + "'");
                result.valid = false;
            }

            var openBrackets = (cleanedCmd.match(/\[/g) || []).length;
            var closeBrackets = (cleanedCmd.match(/\]/g) || []).length;
            if (openBrackets !== closeBrackets) {
                result.errors.push("Mismatched brackets in command: '" + cleanedCmd + "'");
                result.valid = false;
            }

            var openBraces = (cleanedCmd.match(/\{/g) || []).length;
            var closeBraces = (cleanedCmd.match(/\}/g) || []).length;
            if (openBraces !== closeBraces) {
                result.errors.push("Mismatched braces in command: '" + cleanedCmd + "'");
                result.valid = false;
            }

            var isAssignment = /^[A-Za-z0-9_]+[A-Za-z0-9_{}']*\s*[:=]\s*.+/.test(cleanedCmd);
            var isFunctionCall = /^[A-Za-z]+\(.*\)$/.test(cleanedCmd);
            var isTuple = /^\(.*\)$/.test(cleanedCmd);

            if (!isAssignment && !isFunctionCall && !isTuple) {
                result.warnings.push("Command '" + cleanedCmd + "' does not match standard assignment or function call patterns. GeoGebra will auto-name it.");
            }

            var matchAssignment = cleanedCmd.match(/^([A-Za-z0-9_]+[A-Za-z0-9_{}']*)\s*[:=]/);
            if (matchAssignment) {
                definedVariables[matchAssignment[1]] = true;
            }
        }

        return result;
    }

    /**
     * Executes an array of commands on a GeoGebra applet instance.
     * @param {Object} ggbApplet - GeoGebra applet API instance.
     * @param {string[]} commands - Array of command strings.
     * @returns {Object} { success, executed, failed, errors }
     */
    function execute(ggbApplet, commands) {
        var result = {
            success: true,
            executed: 0,
            failed: 0,
            errors: []
        };

        if (!ggbApplet || typeof ggbApplet.evalCommand !== 'function') {
            result.success = false;
            result.errors.push({ index: -1, command: "Init", error: "Invalid GeoGebra applet instance." });
            return result;
        }

        for (var i = 0; i < commands.length; i++) {
            var cmd = commands[i].trim();
            if (cmd === '') continue;

            var execResult = ggbApplet.evalCommand(cmd);
            
            var expectedName = null;
            var matchAssignment = cmd.match(/^([A-Za-z0-9_]+[A-Za-z0-9_{}']*)\s*[:=]/);
            if (matchAssignment) {
                expectedName = matchAssignment[1];
            }

            if (execResult === false) {
                result.failed++;
                result.success = false;
                result.errors.push({ index: i, command: cmd, error: "evalCommand returned false." });
            } else if (expectedName && !ggbApplet.exists(expectedName)) {
                result.failed++;
                result.success = false;
                result.errors.push({ index: i, command: cmd, error: "Expected object '" + expectedName + "' was not created." });
            } else {
                result.executed++;
            }
        }

        return result;
    }

    /**
     * Reads back all defined objects from GeoGebra.
     * @param {Object} ggbApplet - GeoGebra applet API instance.
     * @returns {Object} { objects: [{name, type, x?, y?}] }
     */
    function getConstructionState(ggbApplet) {
        var state = { objects: [] };
        
        if (!ggbApplet || typeof ggbApplet.getAllObjectNames !== 'function') return state;

        var objNamesStr = ggbApplet.getAllObjectNames();
        if (!objNamesStr) return state;

        var objNames = typeof objNamesStr === 'string' ? objNamesStr.split(',') : objNamesStr;
        
        for (var i = 0; i < objNames.length; i++) {
            var name = objNames[i].trim();
            if (!name) continue;

            var type = ggbApplet.getObjectType(name);
            var objData = { name: name, type: type };

            if (type === 'point') {
                objData.x = ggbApplet.getXcoord(name);
                objData.y = ggbApplet.getYcoord(name);
            }

            state.objects.push(objData);
        }

        return state;
    }

    /**
     * Verifies key geometric constraints after execution.
     * @param {Object} ggbApplet - GeoGebra applet API instance.
     * @param {string[]} commands - Originally executed commands.
     * @returns {Object} { valid, issues }
     */
    function verifyConstraints(ggbApplet, commands) {
        var result = {
            valid: true,
            issues: []
        };

        var state = getConstructionState(ggbApplet);
        var objects = state.objects;

        if (objects.length < 2) {
            result.valid = false;
            result.issues.push("Construction contains fewer than 2 objects.");
        }

        var points = [];
        
        for (var i = 0; i < objects.length; i++) {
            var obj = objects[i];
            
            if (obj.type === 'point') {
                if (!isFinite(obj.x) || !isFinite(obj.y)) {
                    result.valid = false;
                    result.issues.push("Point '" + obj.name + "' has non-finite coordinates.");
                } else {
                    points.push(obj);
                }
            }
        }

        for (var p1Idx = 0; p1Idx < points.length; p1Idx++) {
            for (var p2Idx = p1Idx + 1; p2Idx < points.length; p2Idx++) {
                var p1 = points[p1Idx];
                var p2 = points[p2Idx];
                
                var dx = p1.x - p2.x;
                var dy = p1.y - p2.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 0.001) {
                    result.valid = false;
                    result.issues.push("Points '" + p1.name + "' and '" + p2.name + "' are extremely close or occupy the exact same position (dist < 0.001).");
                }
            }
        }

        return result;
    }

    /**
     * Clears the GeoGebra construction.
     * @param {Object} ggbApplet - GeoGebra applet API instance.
     */
    function reset(ggbApplet) {
        if (!ggbApplet) return;

        if (typeof ggbApplet.reset === 'function') {
            ggbApplet.reset();
        } else if (typeof ggbApplet.getAllObjectNames === 'function' && typeof ggbApplet.deleteObject === 'function') {
            var objNamesStr = ggbApplet.getAllObjectNames();
            if (objNamesStr) {
                var objNames = typeof objNamesStr === 'string' ? objNamesStr.split(',') : objNamesStr;
                for (var i = objNames.length - 1; i >= 0; i--) {
                    var name = objNames[i].trim();
                    if (name) {
                        ggbApplet.deleteObject(name);
                    }
                }
            }
        }
    }

    /**
     * Applies visual styling to the objects in the construction.
     * @param {Object} ggbApplet - GeoGebra applet API instance.
     */
    function styleConstruction(ggbApplet) {
        if (!ggbApplet) return;

        var state = getConstructionState(ggbApplet);
        
        for (var i = 0; i < state.objects.length; i++) {
            var obj = state.objects[i];
            var name = obj.name;

            switch (obj.type) {
                case 'point':
                    ggbApplet.setColor(name, 74, 144, 217);
                    ggbApplet.setPointSize(name, 4);
                    ggbApplet.setLabelVisible(name, true);
                    break;
                case 'line':
                case 'segment':
                case 'ray':
                case 'vector':
                    ggbApplet.setColor(name, 85, 85, 85);
                    ggbApplet.setLineThickness(name, 2);
                    break;
                case 'circle':
                case 'conic':
                    ggbApplet.setColor(name, 39, 174, 96);
                    ggbApplet.setLineThickness(name, 2);
                    break;
                case 'polygon':
                    ggbApplet.setColor(name, 51, 51, 51);
                    ggbApplet.setFilling(name, 0.1);
                    break;
                case 'angle':
                    ggbApplet.setColor(name, 230, 126, 34);
                    if (typeof ggbApplet.evalCommand === 'function') {
                        ggbApplet.evalCommand("SetDecoration(" + name + ", 0)"); 
                        ggbApplet.evalCommand("SetDynamicColor(" + name + ", 230/255, 126/255, 34/255)");
                    }
                    break;
            }
        }
    }

    window.ConstructionCompiler = {
        validate: validate,
        execute: execute,
        getConstructionState: getConstructionState,
        verifyConstraints: verifyConstraints,
        reset: reset,
        styleConstruction: styleConstruction
    };
})();