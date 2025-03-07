<?php

/**
 * Plugin Name: Trust Badges
 * Plugin URI: https://converswp.com/trust-badges
 * Description: Trust Badges adds customizable trust icons and badges to WooCommerce and EDD, boosting customer confidence and sales.
 * Version: 1.0.0
 * Author: ConversWP
 * Author URI: https://converswp.com
 * Text Domain: trust-badges
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

if (!defined('ABSPATH')) {
    exit;
}

if (file_exists(dirname(__FILE__) . '/vendor/autoload.php')) {
    require_once dirname(__FILE__) . '/vendor/autoload.php';
}
// Add this near the top after plugin constants
require_once ABSPATH . 'wp-admin/includes/plugin.php';

// Now you can use your classes with their namespaces
use TrustBadges\TrustBadge;

// Define plugin constants
if (!defined('TRUST_BADGES_VERSION')) {
    define('TRUST_BADGES_VERSION', '1.0.0');
}
define('TRUST_BADGES_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TRUST_BADGES_PLUGIN_URL', plugin_dir_url(__FILE__));

// Start the plugin without I18n initialization
add_action('plugins_loaded', function () {
    $plugin = new TrustBadge();
    $plugin->run();
});

// Plugin activation with improved error handling
register_activation_hook(__FILE__, ['TrustBadges\Activator', 'activate']);


if (!function_exists('trust_badges_log_error')) {
    function trust_badges_log_error($message, $context = []) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            $log_message = sprintf(
                '[Trust Badges Error] %s | Context: %s',
                $message,
                json_encode($context)
            );

            do_action('trust_badges_log_error', $log_message, $context);
        }
    }
}