// Existing command now derives only from fresh in-memory SQLite migrations.
import builder from './build_mysql_manifest.js';
await builder.build();
