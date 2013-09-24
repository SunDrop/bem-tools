'use strict';

var parent = module;

while(parent.parent) parent = parent.parent;

// Check if this file is executed directly via fork() from create() method bellow.
if (process.argv[1] === parent.filename) {
    var U = require('../../util');

    process.once('message', function(m) {

        require('borschik').api(m)
            .then(function() {
                process.send({ code: 0 });
                U.oldNode && process.exit(0);
            })
            .fail(function(err) {
                process.send({
                    code: 1,
                    msg: 'Error while processing file ' + m.input + ':\n' + (err.stack || err)
                });
                U.oldNode && process.exit(1);
            })
            .done();

    });

    return;
}

var Q = require('q'),
    cp = require('child_process');

exports.API_VER = 2;

exports.techMixin = {

    getCreateResult: function(path, suffix, vars) {

        var worker = cp.fork(__filename, [], {silent: true}),
            d = Q.defer(),
            out = '',
            handler = function(m) {
                (m.code !== 0)? d.reject(m.msg) : d.resolve(out);
            };

        worker.stdout.on('data', function(data) {
            out += data.toString();
        });

        worker.on('exit', function(code) {
            handler({ code: code });
        });


        worker.on('message', function(m) {
            handler(m);
        });

        var opts = {
            input: this.getPath(vars.Prefix, this.getSuffix(suffix)),
            output: '-',
            tech: this.getMinTech(suffix),
            minimize: (process.env.YENV || '').toLowerCase() === 'production'
        };

        worker.send(opts);

        return d.promise;
    },

    /**
     * Returns suffix for minimized file by source suffix: css -> min.css, js -> min.js etc.
     * @param sourceSuffix suffix of source file.
     * @returns {string} Suffix for minimized file.
     */
    getMinSuffix: function(sourceSuffix) {
        return 'min.' + sourceSuffix;
    },

    /**
     * Returns source suffix by minimized suffix: min.css -> css, min.js -> js etc.
     * @param minSuffix suffix of minimized file.
     * @returns {string} Suffix for source file.
     */
    getSuffix: function(minSuffix) {
        return minSuffix.substr(4);
    },

    /**
     * Returns borschik tech name according to input sourceSuffix.
     * @param sourceSuffix suffix of the input file (css, js, etc).
     * @returns {string} Borschik tech name. When source suffix ends with css will return 'css'.
     * 'js' will be returned otherwise.
     */
    getMinTech: function(sourceSuffix) {
        if (('.' + sourceSuffix).match(/\.css$/)) return 'css';

        return 'js';
    },

    /**
     * Suffixes for the files which will be created.
     * @returns {Array} An array of suffixes. For each suffix in getSuffixes() result there will be a minimized suffix in this array.
     */
    getCreateSuffixes: function() {
        return this.getSuffixes()
            .map(function(suffix) {
                return this.getMinSuffix(suffix);
            }, this);
    },

    storeCreateResult: function(path, suffix, res, force) {
        // always overwrite generated files
        return this.__base(path, suffix, res, true);
    }
};
