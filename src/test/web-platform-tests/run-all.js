"use strict";

const fs = require("fs");
const execSync = require("child_process").execSync;
const path = require("path");
const semver = require("semver");

if (semver.lte(process.version, "8.0.0")) {
    const errorMsg =
        "web-platform-tests only run in Node 8 or higher, but fake-indexeddb should still work in Node 4 and possibly older versions.";
    console.log(errorMsg);
    process.exit(0);
}

const testFolder = path.join(__dirname, "converted");

let passed = 0;
let failed = 0;
let skipped = 0;

const skip = [
    // First test works, but the others... they are extreme edge cases, and I'm not sure exactly what my implementation
    // should be.
    "bindings-inject-key.js",

    // realistic-structured-clone isn't realistic enough, and even if it was, I doubt this test would pass.
    "clone-before-keypath-eval.js",

    // Maximum call stack size exceeded, possibly due to the promise resolution microtask not taking precedence when it
    // should (keep_alive not working).
    "event-dispatch-active-flag.js",
    "transaction-deactivation-timing.js",
    "upgrade-transaction-deactivation-timing.js",

    // These are pretty tricky. Would be nice to have them working.
    "fire-error-event-exception.js",
    "fire-success-event-exception.js",
    "fire-upgradeneeded-event-exception.js",

    // No Web Worker in Node.js.
    "idb-binary-key-detached.js",
    "idb_webworkers.js",

    // Mostly works, but Node.js doesn't support trailing commas in function parameters, and there's some other subtle
    // issues too.
    "idb-binary-key-roundtrip.js",

    // Usually works, but there is a race condition. Sometimes the setTimeout runs before the transaction commits.
    "idbcursor-continue-exception-order.js",
    "idbcursor-delete-exception-order.js",
    "idbcursor-update-exception-order.js",
    "idbobjectstore-add-put-exception-order.js",
    "idbobjectstore-clear-exception-order.js",
    "idbobjectstore-delete-exception-order.js",
    "idbobjectstore-deleteIndex-exception-order.js",
    "idbobjectstore-query-exception-order.js",

    // No iframe in Node.js.
    "idbfactory-deleteDatabase-opaque-origin.js",
    "idbfactory-open-opaque-origin.js",

    // Hangs because `dbname` is the same for all the async tests. If `dbname` was different for each async test, it
    // would work.
    "idbfactory_open9.js",

    // Mostly works, but subtlely wrong behavior when renaming a newly-created index/store and then aborting the upgrade
    // transaction (this has roughly 0 real world impact, but could be indicative of other problems in fake-indexeddb).
    "idbindex-rename-abort.js",
    "idbobjectstore-rename-abort.js",
    "transaction-abort-index-metadata-revert.js",
    "transaction-abort-multiple-metadata-revert.js",
    "transaction-abort-object-store-metadata-revert.js",

    // Half works, and I don't care enough to investigate further right now.
    "idbrequest-onupgradeneeded.js",

    // The tests pass, but then it hangs because the "value after close" tests don't listen for onsuccess. Adding
    // `open2.onsuccess = (e) => e.target.result.close();` fixes it.
    "idbtransaction_objectStoreNames.js",

    // Looks complicated to get running in Node.js, but would be nice.
    "interfaces.js",

    // Would be nice to fix, but not highly important. Various bugs here.
    "keypath-exceptions.js",

    // Node.js doesn't have Blob or File.
    "keypath-special-identifiers.js",

    // All kinds of fucked up.
    "open-request-queue.js",

    // Usually works, but sometimes fails. Not sure why.
    "parallel-cursors-upgrade.js",

    // Did not investigate in great detail.
    "transaction-abort-generator-revert.js",
    "transaction-lifetime-empty.js",
    "upgrade-transaction-lifecycle-backend-aborted.js",
    "upgrade-transaction-lifecycle-user-aborted.js",

    // Fails because `onerror` is never called since it is set after the abort call and the events on the request are
    // triggered synchronously. Not sure how to reconcile this with the spec. Same issue affected some other test too, I
    // think.
    "transaction-abort-request-error.js",
];

const filenames = fs.readdirSync(testFolder);
for (const filename of filenames) {
    if (skip.includes(filename)) {
        console.log(`Skipping ${filename}...\n`);
        skipped += 1;
        continue;
    }

    console.log(`Running ${filename}...`);
    try {
        const output = execSync(`node ${path.join(testFolder, filename)}`, {
            cwd: testFolder,
        });
        if (output.toString().length > 0) {
            console.log(output.toString());
        }
        console.log("Success!\n");
        passed += 1;
    } catch (err) {
        console.log("");
        failed += 1;
    }
}

if (skipped !== skip.length) {
    const errorMsg = `Skipped ${skipped} tests, but skip.length is ${
        skip.length
    }. Missing file?`;
    throw new Error(errorMsg);
}

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Skipped: ${skipped}\n`);

const pct = Math.round((100 * passed) / (passed + failed + skipped));
console.log(`Success Rate: ${pct}%`);

if (failed > 0) {
    process.exit(1);
}
