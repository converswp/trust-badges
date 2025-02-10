<?php

class TX_Badges {
    protected $loader;
    protected $plugin_name;
    protected $version;

    public function __construct() {
        $this->version = TX_BADGES_VERSION;
        $this->plugin_name = 'tx-badges';

        $this->load_dependencies();
        $this->set_locale();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_rest_api();

        add_filter( 'woocommerce_should_load_cart_block', '__return_false' );
        add_filter( 'woocommerce_should_load_checkout_block', '__return_false' );

        // Add WooCommerce hooks if WooCommerce is active
        if (is_plugin_active('woocommerce/woocommerce.php')) {
            add_action('woocommerce_after_add_to_cart_form', array($this, 'display_badges_after_add_to_cart'));
            add_action('woocommerce_before_add_to_cart_form', array($this, 'display_badges_before_add_to_cart'));

            add_action('woocommerce_after_cart_totals', array($this, 'display_badges_after_cart_totals_on_cart'));
        }

        // Add footer hook for displaying badges
        add_action('wp_footer', array($this, 'display_footer_badges'));
    }

    private function load_dependencies() {
        require_once TX_BADGES_PLUGIN_DIR . 'includes/class-tx-badges-loader.php';
        require_once TX_BADGES_PLUGIN_DIR . 'includes/class-tx-badges-i18n.php';
        require_once TX_BADGES_PLUGIN_DIR . 'includes/class-tx-badges-rest-api.php';

        $this->loader = new TX_Badges_Loader();
    }

    private function set_locale() {
        $plugin_i18n = new TX_Badges_i18n();
        $this->loader->add_action('plugins_loaded', $plugin_i18n, 'load_plugin_textdomain');
    }

    private function define_admin_hooks() {
        $this->loader->add_action('admin_menu', $this, 'add_plugin_admin_menu');
    }

    private function define_public_hooks() {
        // $plugin_public = new TX_Badges_Public($this->get_plugin_name(), $this->get_version());

        // $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
        // $this->loader->add_action('wp_0enqueue_scripts', $plugin_public, 'enqueue_scripts');
        // $this->loader->add_action('woocommerce_after_add_to_cart_form', $plugin_public, 'display_trust_badges');
    }

    private function define_rest_api() {
        $plugin_rest = new TX_Badges_REST_API();
        $this->loader->add_action('rest_api_init', $plugin_rest, 'register_routes');
    }

    public function run() {
        $this->loader->run();
    }

    public function get_plugin_name() {
        return $this->plugin_name;
    }

    public function get_version() {
        return $this->version;
    }

    /**
     * Add plugin admin menu
     */
    public function add_plugin_admin_menu() {
        add_menu_page(
            __('TX Trust Badges', 'tx-badges'),
            __('Trust Badges', 'tx-badges'),
            'manage_options',
            $this->plugin_name,
            array($this, 'display_plugin_setup_page'),
            'dashicons-shield',
            25
        );
    }

    /**
     * Render the settings page for this plugin.
     */
    public function display_plugin_setup_page() {
        echo '<div id="tx-badges-app"></div>';
    }

    /**
     * Display badges after add to cart button
     */
    public function display_badges_after_add_to_cart() {
        $this->display_badges_by_position('showAfterAddToCart');
    }

    /**
     * Display badges before add to cart button
     */
    public function display_badges_before_add_to_cart() {
        $this->display_badges_by_position('showBeforeAddToCart');
    }

    /**
     * Display badges on cart page
     */
    public function display_badges_after_cart_totals_on_cart() {
        $this->display_badges_by_position('showOnCheckout');
    }

    /**
     * Helper function to display badges based on position
     */
    private function display_badges_by_position($position) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'converswp_trust_badges';

        // Get active WooCommerce badge group with specific settings
        $group = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM $table_name 
                WHERE is_active = 1 
                AND required_plugin = %s 
                AND group_id = %s",
                'woocommerce',
                'woocommerce'
            )
        );

        if (!$group) {
            return;
        }

        // Decode settings
        $settings = json_decode($group->settings, true);
        
        // Debug log to check settings
        error_log('Badge Display Check: ' . print_r([
            'position' => $position,
            'enabled' => isset($settings[$position]) ? $settings[$position] : false
        ], true));
        
        // Check if this position is enabled
        if (!isset($settings[$position]) || !$settings[$position]) {
            return;
        }

        // Render badges with exact settings
        $this->render_badges($settings);
    }

    /**
     * Get alignment style value
     */
    private function get_alignment_style($alignment) {
        $styles = [
            'left' => 'flex-start',
            'center' => 'center',
            'right' => 'flex-end'
        ];
        return $styles[$alignment] ?? 'center';
    }

    /**
     * Get margin style string if custom margins are enabled
     */
    private function get_margin_style($settings) {
        if (empty($settings['customMargin'])) {
            return '';
        }

        $top = isset($settings['marginTop']) ? intval($settings['marginTop']) : 0;
        $right = isset($settings['marginRight']) ? intval($settings['marginRight']) : 0;
        $bottom = isset($settings['marginBottom']) ? intval($settings['marginBottom']) : 0;
        $left = isset($settings['marginLeft']) ? intval($settings['marginLeft']) : 0;

        return sprintf('margin: %dpx %dpx %dpx %dpx;',
            $top,
            $right,
            $bottom,
            $left
        );
    }

    /**
     * Get animation class based on settings
     */
    private function get_animation_class($animation) {
        if (empty($animation)) {
            return '';
        }
        return 'badge-' . esc_attr($animation);
    }

    /**
     * Get animation styles based on settings
     */
    private function get_animation_styles($animation) {
        if (empty($animation)) {
            return '';
        }

        $styles = '';
        
        // Base opacity for all animations
        $styles .= '.convers-trust-badges { opacity: 1; }';
        $styles .= '.badge-container { opacity: 0; }';
        
        // Animation definition based on type
        switch ($animation) {
            case 'fade':
                $styles .= '
                    .badge-fade .badge-container {
                        animation: badgeFadeIn 0.5s ease forwards;
                        animation-delay: calc(var(--badge-index, 0) * 0.1s);
                    }
                    @keyframes badgeFadeIn {
                        0% { opacity: 0; }
                        100% { opacity: 1; }
                    }
                ';
                break;
                
            case 'slide':
                $styles .= '
                    .badge-slide .badge-container {
                        transform: translateY(20px);
                        animation: badgeSlideIn 0.5s ease forwards;
                        animation-delay: calc(var(--badge-index, 0) * 0.1s);
                    }
                    @keyframes badgeSlideIn {
                        0% { 
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        100% {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                ';
                break;
                
            case 'scale':
                $styles .= '
                    .badge-scale .badge-container {
                        transform: scale(0.8);
                        animation: badgeScaleIn 0.5s ease forwards;
                        animation-delay: calc(var(--badge-index, 0) * 0.1s);
                    }
                    @keyframes badgeScaleIn {
                        0% {
                            opacity: 0;
                            transform: scale(0.8);
                        }
                        100% {
                            opacity: 1;
                            transform: scale(1);
                        }
                    }
                ';
                break;
                
            case 'bounce':
                $styles .= '
                    .badge-bounce .badge-container {
                        animation: badgeBounceIn 0.6s cubic-bezier(0.36, 0, 0.66, -0.56) forwards;
                        animation-delay: calc(var(--badge-index, 0) * 0.1s);
                    }
                    @keyframes badgeBounceIn {
                        0% {
                            opacity: 0;
                            transform: scale(0.3);
                        }
                        50% {
                            opacity: 0.9;
                            transform: scale(1.1);
                        }
                        80% {
                            opacity: 1;
                            transform: scale(0.89);
                        }
                        100% {
                            opacity: 1;
                            transform: scale(1);
                        }
                    }
                ';
                break;
        }
        
        return $styles;
    }

    /**
     * Render badges with settings
     */
    private function render_badges($settings) {
        // Log the incoming settings for debugging
        error_log('Rendering badges with settings: ' . print_r($settings, true));

        // Get exact alignment class from settings
        $alignment_class = 'align-' . ($settings['badgeAlignment'] ?? 'center');
        $style_class = 'style-' . ($settings['badgeStyle'] ?? 'original');
        $animation_class = $settings['animation'] ? $this->get_animation_class($settings['animation']) : '';

        // Get margin style if custom margin is enabled
        $margin_style = $this->get_margin_style($settings);

        // Get exact sizes
        $desktop_size = $this->get_size_values($settings['badgeSizeDesktop']);
        $mobile_size = $this->get_size_values($settings['badgeSizeMobile']);

        // Start badge container without margin style
        echo '<div class="convers-trust-badges ' . esc_attr($alignment_class) . ' ' . esc_attr($animation_class) . '">';
        
        // Show header if enabled with exact settings
        if (!empty($settings['showHeader'])) {
            echo '<div class="trust-badges-header" style="';
            echo 'font-size: ' . esc_attr($settings['fontSize']) . 'px;';
            echo 'color: ' . esc_attr($settings['textColor']) . ';';
            echo 'text-align: ' . esc_attr($settings['alignment']) . ';';
            if (!empty($settings['customStyles'])) {
                echo esc_attr($settings['customStyles']);
            }
            echo '">';
            echo esc_html($settings['headerText']);
            echo '</div>';
        }

        // Start badges wrapper
        echo '<div class="trust-badges-wrapper ' . esc_attr($style_class) . '" style="';
        echo 'display: flex;';
        echo 'flex-wrap: wrap;';
        echo 'gap: 10px;';
        echo 'justify-content: ' . $this->get_alignment_style($settings['badgeAlignment'] ?? 'center') . ';';
        echo 'align-items: center;';
        echo '">';

        // Display selected badges with exact settings
        if (!empty($settings['selectedBadges'])) {
            foreach ($settings['selectedBadges'] as $index => $badge_id) {
                $filename = $this->get_badge_filename($badge_id);
                $badge_url = plugins_url('assets/images/badges/' . $filename, dirname(__FILE__));
                
                // Add badge index and margin style to each badge container
                echo '<div class="badge-container" style="--badge-index: ' . esc_attr($index) . ';' . $margin_style . '">';
                
                if (in_array($settings['badgeStyle'], ['mono', 'mono-card'])) {
                    echo '<div class="badge-image" style="';
                    echo '-webkit-mask: url(' . esc_url($badge_url) . ') center/contain no-repeat;';
                    echo 'mask: url(' . esc_url($badge_url) . ') center/contain no-repeat;';
                    echo 'background-color: ' . esc_attr($settings['badgeColor']) . ';';
                    echo 'width: ' . esc_attr($mobile_size) . 'px;';
                    echo 'height: ' . esc_attr($mobile_size) . 'px;';
                    echo 'transition: all 0.3s ease;';
                    echo '"></div>';
                } else {
                    echo '<img src="' . esc_url($badge_url) . '" alt="converswp-trust-badge" class="badge-image" style="';
                    echo 'width: ' . esc_attr($mobile_size) . 'px;';
                    echo 'height: auto;';
                    echo 'max-height: ' . esc_attr($mobile_size) . 'px;';
                    echo 'transition: all 0.3s ease;';
                    echo 'object-fit: contain;';
                    echo '" />';
                }
                
                echo '</div>';
            }
        }

        echo '</div>'; // Close badges wrapper
        echo '</div>'; // Close badge container

        // Add responsive styles with exact sizes
        $this->add_responsive_styles($settings);
    }

    /**
     * Add responsive styles for badge sizes
     */
    private function add_responsive_styles($settings) {
        $desktop_size = $this->get_size_values($settings['badgeSizeDesktop']);
        $mobile_size = $this->get_size_values($settings['badgeSizeMobile']);
        $animation = isset($settings['animation']) ? $settings['animation'] : '';

        // Get animation styles based on settings
        $animation_styles = $this->get_animation_styles($animation);

        // Get design settings from database
        $badge_padding = isset($settings['badgePadding']) ? intval($settings['badgePadding']) : 5;
        $badge_gap = isset($settings['badgeGap']) ? intval($settings['badgeGap']) : 10;
        $container_margin = isset($settings['containerMargin']) ? intval($settings['containerMargin']) : 15;
        $border_radius = isset($settings['borderRadius']) ? intval($settings['borderRadius']) : 4;
        $hover_transform = isset($settings['hoverTransform']) ? $settings['hoverTransform'] : 'translateY(-2px)';
        $transition = isset($settings['transition']) ? $settings['transition'] : 'all 0.3s ease';

        echo '<style>
            .convers-trust-badges {
                margin: ' . $container_margin . 'px 0;
                width: 100%;
            }
            .trust-badges-wrapper {
                display: flex;
                flex-wrap: wrap;
                gap: ' . $badge_gap . 'px;
                align-items: center;
                width: 100%;
            }
            .badge-container {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: ' . $badge_padding . 'px;
                transition: ' . esc_attr($transition) . ';
            }
            
            /* Mobile styles (default) */
            .badge-image {
                width: ' . esc_attr($mobile_size) . 'px !important;
                height: auto !important;
                max-height: ' . esc_attr($mobile_size) . 'px !important;
                transition: ' . esc_attr($transition) . ';
                object-fit: contain;
            }
            
            .style-mono .badge-image,
            .style-mono-card .badge-image {
                width: ' . esc_attr($mobile_size) . 'px !important;
                height: ' . esc_attr($mobile_size) . 'px !important;
                -webkit-mask-size: contain;
                mask-size: contain;
                -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
                -webkit-mask-position: center;
                mask-position: center;
                background-color: ' . esc_attr($settings['badgeColor']) . ';
            }
            
            /* Desktop styles */
            @media screen and (min-width: 768px) {
                .badge-image {
                    width: ' . esc_attr($desktop_size) . 'px !important;
                    height: auto !important;
                    max-height: ' . esc_attr($desktop_size) . 'px !important;
                }
                
                .style-mono .badge-image,
                .style-mono-card .badge-image {
                    width: ' . esc_attr($desktop_size) . 'px !important;
                    height: ' . esc_attr($desktop_size) . 'px !important;
                }
            }
            
            /* Hover effects */
            .badge-container:hover {
                transform: ' . esc_attr($hover_transform) . ';
            }
            .badge-container:hover .badge-image {
                transform: scale(1.05);
            }
            
            /* Card styles */
            .style-card .badge-container,
            .style-mono-card .badge-container {
                background-color: #e5e7eb;
                padding: ' . ($badge_padding + 3) . 'px ' . ($badge_padding + 7) . 'px;
                border-radius: ' . esc_attr($border_radius) . 'px;
            }
            
            /* Alignment */
            .align-left .trust-badges-wrapper { justify-content: flex-start; }
            .align-center .trust-badges-wrapper { justify-content: center; }
            .align-right .trust-badges-wrapper { justify-content: flex-end; }

            /* Animation styles */
            ' . $animation_styles . '
        </style>';
    }

    /**
     * Convert size names to pixel values
     */
    private function get_size_values($size) {
        $sizes = [
            'extra-small' => 32,
            'small' => 48,
            'medium' => 64,
            'large' => 80
        ];

        return $sizes[$size] ?? 48;
    }

    private function get_badge_filename($badge_id) {
        // Implement the logic to determine the correct filename based on the badge_id
        // This is a placeholder and should be replaced with the actual implementation
        return str_replace('-', '_', $badge_id) . '.svg';
    }

    /**
     * Display badges in footer
     */
    public function display_footer_badges() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'converswp_trust_badges';

        // Get active footer badge group
        $group = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM $table_name 
                WHERE is_active = 1 
                AND group_id = %s",
                'footer'
            )
        );

        if (!$group || !$group->settings) {
            return;
        }

        // Decode settings
        $settings = json_decode($group->settings, true);
        
        // Get position from settings (left, center, right)
        $position = isset($settings['position']) ? $settings['position'] : 'center';
        
        // Create container with position class
        echo '<div class="convers-trust-badges-footer">';
        $this->render_badges($settings);
        echo '</div>';

        // Add footer-specific styles with position
        $this->add_footer_styles($position);
    }

    /**
     * Add footer-specific styles
     */
    private function add_footer_styles($position) {
        echo '<style>
            .convers-trust-badges-footer {
                width: 100%;
                padding: 20px;
            }
            
            .convers-trust-badges-footer .trust-badges-wrapper {
                justify-content: ' . $this->get_position_style($position) . ';
            }
            
            @media screen and (max-width: 768px) {
                .convers-trust-badges-footer {
                    padding: 15px;
                }
            }
        </style>';
    }

    /**
     * Get position style value
     */
    private function get_position_style($position) {
        $styles = [
            'left' => 'flex-start',
            'center' => 'center',
            'right' => 'flex-end'
        ];
        return $styles[$position] ?? 'center';
    }
}
