<?php
declare(strict_types=1);

/**
 * Veniux Dark Precision Reusable Component Library
 * High-performance, accessible, semantic PHP/Blade-style UI components
 */

if (!function_exists('veniuxButton')) {
    function veniuxButton(string $label, string $href = '#', string $variant = 'primary', array $attrs = []): string {
        $classes = ['dp-btn'];
        if ($variant === 'primary') $classes[] = 'dp-btn--primary';
        elseif ($variant === 'accent') $classes[] = 'dp-btn--accent';
        elseif ($variant === 'outline') $classes[] = 'dp-btn--outline';
        elseif ($variant === 'ghost') $classes[] = 'dp-btn--ghost';
        
        if (!empty($attrs['class'])) {
            $classes[] = $attrs['class'];
            unset($attrs['class']);
        }
        
        $attrStr = '';
        foreach ($attrs as $k => $v) {
            $attrStr .= ' ' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '="' . htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8') . '"';
        }
        
        $classStr = implode(' ', $classes);
        return sprintf(
            '<a href="%s" class="%s"%s>%s</a>',
            htmlspecialchars($href, ENT_QUOTES, 'UTF-8'),
            $classStr,
            $attrStr,
            $label
        );
    }
}

if (!function_exists('veniuxCard')) {
    function veniuxCard(string $content, array $props = []): string {
        $classes = ['dp-card'];
        if (!empty($props['elevated'])) $classes[] = 'dp-card--elevated';
        if (!empty($props['featured'])) $classes[] = 'dp-card--featured';
        if (!empty($props['class'])) $classes[] = $props['class'];
        
        $tag = $props['tag'] ?? 'div';
        $classStr = implode(' ', $classes);
        return sprintf('<%s class="%s">%s</%s>', $tag, $classStr, $content, $tag);
    }
}

if (!function_exists('veniuxSection')) {
    function veniuxSection(string $content, array $props = []): string {
        $id = !empty($props['id']) ? ' id="' . htmlspecialchars($props['id'], ENT_QUOTES, 'UTF-8') . '"' : '';
        $classes = ['dp-section'];
        if (!empty($props['class'])) $classes[] = $props['class'];
        $classStr = implode(' ', $classes);
        
        $headerHtml = '';
        if (!empty($props['eyebrow']) || !empty($props['title']) || !empty($props['lead'])) {
            $headerHtml .= '<div class="dp-section-header">';
            if (!empty($props['eyebrow'])) {
                $headerHtml .= '<p class="dp-eyebrow"><span class="dp-eyebrow-dot"></span> ' . htmlspecialchars($props['eyebrow'], ENT_QUOTES, 'UTF-8') . '</p>';
            }
            if (!empty($props['title'])) {
                $headerHtml .= '<h2 class="dp-h2">' . $props['title'] . '</h2>';
            }
            if (!empty($props['lead'])) {
                $headerHtml .= '<p class="dp-lead">' . htmlspecialchars($props['lead'], ENT_QUOTES, 'UTF-8') . '</p>';
            }
            $headerHtml .= '</div>';
        }
        
        return sprintf(
            '<section%s class="%s"><div class="dp-container">%s%s</div></section>',
            $id,
            $classStr,
            $headerHtml,
            $content
        );
    }
}

if (!function_exists('veniuxInput')) {
    function veniuxInput(string $name, string $label, string $type = 'text', array $props = []): string {
        $value = $props['value'] ?? '';
        $placeholder = $props['placeholder'] ?? '';
        $required = !empty($props['required']) ? ' required' : '';
        $autocomplete = !empty($props['autocomplete']) ? ' autocomplete="' . htmlspecialchars($props['autocomplete'], ENT_QUOTES, 'UTF-8') . '"' : '';
        $extra = '';
        if (isset($props['minlength'])) $extra .= ' minlength="' . (int)$props['minlength'] . '"';
        if (isset($props['maxlength'])) $extra .= ' maxlength="' . (int)$props['maxlength'] . '"';
        
        return sprintf(
            '<div class="dp-form-group">
                <label class="dp-label" for="dp-inp-%s">%s</label>
                <input class="dp-input" type="%s" id="dp-inp-%s" name="%s" value="%s" placeholder="%s"%s%s%s>
            </div>',
            htmlspecialchars($name, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($label, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($type, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($name, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($name, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($value, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($placeholder, ENT_QUOTES, 'UTF-8'),
            $required,
            $autocomplete,
            $extra
        );
    }
}

if (!function_exists('veniuxToast')) {
    function veniuxToast(string $message, string $type = 'info'): string {
        return sprintf(
            '<div class="dp-toast dp-toast--%s" role="alert">
                <span class="dp-toast-dot"></span>
                <span class="dp-toast-text">%s</span>
            </div>',
            htmlspecialchars($type, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($message, ENT_QUOTES, 'UTF-8')
        );
    }
}

if (!function_exists('veniuxModal')) {
    function veniuxModal(string $id, string $title, string $content): string {
        return sprintf(
            '<dialog id="%s" class="dp-modal" aria-labelledby="%s-title">
                <div class="dp-modal-box">
                    <div class="dp-modal-header">
                        <h3 id="%s-title" class="dp-modal-title">%s</h3>
                        <button type="button" class="dp-modal-close" onclick="document.getElementById(\'%s\').close()" aria-label="Kapat">✕</button>
                    </div>
                    <div class="dp-modal-body">%s</div>
                </div>
            </dialog>',
            htmlspecialchars($id, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($id, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($id, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($title, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($id, ENT_QUOTES, 'UTF-8'),
            $content
        );
    }
}
