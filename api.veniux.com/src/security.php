<?php
declare(strict_types=1);

function securityHeaders(): void {
    header_remove('X-Powered-By');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    if (($_SERVER['HTTPS'] ?? '') === 'on') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}
