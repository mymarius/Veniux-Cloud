<?php
declare(strict_types=1);
function setting(string $name): string {
    static $settings;
    if ($settings === null) {
        $file=dirname(__DIR__).'/config/settings.php';
        $settings=is_file($file) ? require $file : [];
        if (!is_array($settings)) throw new RuntimeException('Invalid configuration');
    }
    $value=getenv($name);
    if ($value !== false && $value !== '') return $value;
    return is_string($settings[$name]??null) ? $settings[$name] : '';
}
