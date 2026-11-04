<?php
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// Only serve public assets. Configuration/router PHP must never be downloadable.
if (preg_match('~^/assets/[a-zA-Z0-9._-]+$~', $path) && is_file(__DIR__ . $path)) return false;
require __DIR__ . '/index.php';
