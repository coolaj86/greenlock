'use strict';

var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;
var path = require('path');
var PKG_DIR = path.join(__dirname, '..');

module.exports.installSync = function(moduleName) {
	var npm = 'npm';
	var args = ['install', '--save', moduleName];
	var out = '';
	var cmd;

	try {
		cmd = spawnSync(npm, args, {
			cwd: PKG_DIR,
			windowsHide: true
		});
	} catch (e) {
		console.error(
			"Failed to start: '" +
				npm +
				' ' +
				args.join(' ') +
				"' in '" +
				PKG_DIR +
				"'"
		);
		console.error(e.message);
		process.exit(1);
	}

	if (!cmd.status) {
		return;
	}

  out += cmd.stdout.toString('utf8');
  out += cmd.stderr.toString('utf8');

	if (out) {
		console.error(out);
		console.error();
		console.error();
	}

	console.error(
		"Failed to run: '" +
			npm +
			' ' +
			args.join(' ') +
			"' in '" +
			PKG_DIR +
			"'"
	);

	console.error(
		'Try for yourself:\n\tcd ' + PKG_DIR + '\n\tnpm ' + args.join(' ')
	);

	process.exit(1);
};

module.exports.install = function(moduleName) {
	return new Promise(function(resolve) {
		if (!moduleName) {
			throw new Error('no module name given');
		}

		var npm = 'npm';
		var args = ['install', '--save', moduleName];
		var out = '';
		var cmd = spawn(npm, args, {
			cwd: PKG_DIR,
			windowsHide: true
		});

		cmd.stdout.on('data', function(chunk) {
			out += chunk.toString('utf8');
		});
		cmd.stdout.on('data', function(chunk) {
			out += chunk.toString('utf8');
		});

		cmd.on('error', function(e) {
			console.error(
				"Failed to start: '" +
					npm +
					' ' +
					args.join(' ') +
					"' in '" +
					PKG_DIR +
					"'"
			);
			console.error(e.message);
			process.exit(1);
		});

		cmd.on('exit', function(code) {
			if (!code) {
				resolve();
				return;
			}

			if (out) {
				console.error(out);
				console.error();
				console.error();
			}
			console.error(
				"Failed to run: '" +
					npm +
					' ' +
					args.join(' ') +
					"' in '" +
					PKG_DIR +
					"'"
			);
			console.error(
				'Try for yourself:\n\tcd ' +
					PKG_DIR +
					'\n\tnpm ' +
					args.join(' ')
			);
			process.exit(1);
		});
	});
};

if (require.main === module) {
	module.exports.installSync(process.argv[2]);
}