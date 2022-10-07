import Handlebars from "handlebars/runtime.js";
import {nanoid} from 'nanoid';

const promises = {};

/**
 * Register an asynchronous helper
 *
 * @param hbs {Handlebars} the handlebars instance to add the helper to.
 * @param name {string} the name of the helper
 * @param func {function} handler signature `function(options,context)`
 */
export function registerAsyncHelper(hbs, name, func) {

    // write wrapper function that intercepts promises as outputs, replaces
    // their output with a unique identifier. If a promise was found, let's wait
    // for it to resolve.
    const wrappedFunc = function(options, context) {
        const output = func(options, context);

        // not a promise, just forward the value
        if (output.constructor.name !== 'Promise') {
            return output;
        }

        // create unique identifier.
        const id = nanoid();
        promises[id] = {id, output};

        // for now write a placeholder
        return `@@${id}@@`;
    };

    hbs.registerHelper(name, wrappedFunc);

}

/**
 * Try to render a handlebars element asynchronously, by finding
 * async waiting placeholders in the resulting text and resolving their
 * references.
 *
 * @param hbs {Handlebars} handlebar instance.
 * @param templateName {string} template name to render
 * @param model {object} the model to pass into the
 */
export async function hbsAsyncRender(hbs, templateName, model) {

    // get initial template output
    let output = hbs.templates[templateName](model);

    // no asynchronous helpers called?
    if (Object.keys(promises).length === 0) {
        return output;
    }

    // for each promise that was stored, let's resolve them all at once
    const promisesVals = Object.values(promises);
    const results = await Promise.allSettled(promisesVals.map(p => p.output));

    // once resolved, let's replace their placeholders with their values
    let idx = 0;
    for (const result of results) {

        let resultString = "";
        if (result.status === 'rejected') {
            console.log("ERROR:",result);
            resultString = `<!-- error in async promise: ${result.reason} -->`;
        }
        else {
            resultString = result.value;
        }

        const replaceId = promisesVals[idx].id;
        output = output.replace(`@@${replaceId}@@`, resultString);
        console.log("RESULT", replaceId, resultString);

        delete promises[replaceId];
        ++idx;
    }

    return output;
}
