require("../../build/global.js");
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;



indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const release_tx = keep_alive(tx, 'store');
    assert_true(is_transaction_active(tx, 'store'),
                'Transaction should be active after creation');

    setTimeout(t.step_func(() => {
      assert_false(is_transaction_active(tx, 'store'),
                   'Transaction should be inactive in next task');
      release_tx();
      t.done();
    }), 0);
  },
  'New transactions are deactivated before next task');

indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const release_tx = keep_alive(tx, 'store');
    assert_true(is_transaction_active(tx, 'store'),
                'Transaction should be active after creation');

    Promise.resolve().then(t.step_func(() => {
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active in microtask checkpoint');
      release_tx();
      t.done();
    }));
  },
  'New transactions are not deactivated until after the microtask checkpoint');

indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    let tx, release_tx;

    Promise.resolve().then(t.step_func(() => {
      tx = db.transaction('store');
      release_tx = keep_alive(tx, 'store');
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active after creation');
    }));

    setTimeout(t.step_func(() => {
      assert_false(is_transaction_active(tx, 'store'),
                   'Transaction should be inactive in next task');
      release_tx();
      t.done();
    }), 0);
  },
  'New transactions from microtask are deactivated before next task');

indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    let tx, release_tx;

    Promise.resolve().then(t.step_func(() => {
      tx = db.transaction('store');
      release_tx = keep_alive(tx, 'store');
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active after creation');
    }));

    Promise.resolve().then(t.step_func(() => {
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active in microtask checkpoint');
      release_tx();
      t.done();
    }));
  },
  'New transactions from microtask are still active through the ' +
  'microtask checkpoint');


indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    // This transaction serves as the source of an event seen by multiple
    // listeners. A DOM event with multiple listeners could be used instead,
    // but not via dispatchEvent() because (drumroll...) that happens
    // synchronously so microtasks don't run between steps.
    const tx = db.transaction('store');
    assert_true(is_transaction_active(tx, 'store'),
                'Transaction should be active after creation');

    const request = tx.objectStore('store').get(0);
    let new_tx;
    let first_listener_ran = false;
    let microtasks_ran = false;
    request.addEventListener('success', t.step_func(() => {
      first_listener_ran = true;
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active in callback');

      // We check to see if this transaction is active across unrelated event
      // dispatch steps.
      new_tx = db.transaction('store');
      assert_true(is_transaction_active(new_tx, 'store'),
                  'New transaction should be active after creation');

      Promise.resolve().then(t.step_func(() => {
        microtasks_ran = true;
        assert_true(is_transaction_active(new_tx, 'store'),
                    'New transaction is still active in microtask checkpoint');
      }));

    }));
    request.addEventListener('success', t.step_func(() => {
      assert_true(first_listener_ran, 'first listener ran first');
      assert_true(microtasks_ran, 'microtasks ran before second listener');
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active in callback');
      assert_false(is_transaction_active(new_tx, 'store'),
                   'New transaction should be inactive in unrelated callback');
      t.done();
    }));
  },
  'Deactivation of new transactions happens at end of invocation');
