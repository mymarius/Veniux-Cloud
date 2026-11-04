// Failed credentials in a lock/supervisor prompt must not destroy the current
// cashier session or its recovery draft. All ordinary API 401/423 handling stays.
export const isTerminalReauth=config=>config?.url==='/auth/terminal-verify'&&config?.terminalReauth===true;
