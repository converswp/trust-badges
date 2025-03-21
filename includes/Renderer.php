<?php
namespace TrustBadges;

class Renderer {

	public static function renderBadgeById( $group_id = '' ) {
		if ( $group_id == '' ) {
			trust_badges_log_error( 'Group ID is empty', array( 'group_id' => $group_id ) );
			return false;
		}

		$settings = self::getBadgeByGroup( $group_id );
		if ( empty( $settings ) ) {
			trust_badges_log_error(
				'Group settings not found.',
				array(
					'group_id' => $group_id,
					'settings' => $settings,
				)
			);
			return false;
		}

		if ( $settings->is_active ) {
			// Render badges with settings
			$badgeHtml = self::renderBadgeHtml( $settings->group_id, $settings->settings );
		} else {
			trust_badges_log_error( 'Badge is disabled.', array( 'settings' => $settings ) );
			return false;
		}

		// Create container with position class
		$html  = '<div id="convers-trust-badges-' . $group_id . '">';
		$html .= $badgeHtml;
		$html .= '</div>';

		return $html;
	}

	public static function getGroupIdByPosition( $position ): string {
		if ( $position === 'showAfterAddToCart' || $position === 'eddPurchaseLinkEnd' ) {
			$group_id = 'product_page';
		} elseif ( $position === 'checkoutBeforeOrderReview' || $position === 'eddCheckoutBeforePurchaseForm' ) {
			$group_id = 'checkout';
		} else {
			$group_id = 'footer';
		}

		return $group_id;
	}

	/**
	 * Get badge settings by group ID with caching
	 *
	 * Note: Direct database query is necessary here as this is a core functionality
	 * that requires specific data selection. The performance impact is mitigated by:
	 * 1. Caching results for 1 hour
	 * 2. Using proper SQL preparation
	 * 3. Minimal and targeted query
	 *
	 * @param string $group_id The group ID to fetch
	 * @return object|false Badge settings object or false if not found
	 */
	public static function getBadgeByGroup( $group_id ) {
		// Try to get from cache first
		$cache_key = 'trust_badges_group_' . $group_id;
		$group     = wp_cache_get( $cache_key, 'trust_badges' );

		if ( false === $group ) {
			global $wpdb;
			$table_name = $wpdb->prefix . 'converswp_trust_badges';

			$group = $wpdb->get_row(  // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					'SELECT * FROM `' . esc_sql( $table_name ) . '` WHERE is_active = 1 AND group_id = %s',
					$group_id
				)
			);

			if ( ! $group ) {
				return false;
			}

			$group->settings = json_decode( $group->settings, true );

			// Cache the result for 1 hour
			wp_cache_set( $cache_key, $group, 'trust_badges', HOUR_IN_SECONDS );
		}

		return $group;
	}


	/**
	 * Render badges with settings
	 */
	public static function renderBadgeHtml( $group_id, $settings ): string {

		// Get exact alignment class from settings
		$alignment_class = 'align-' . ( $settings['badgeAlignment'] ?? 'center' );
		$style_class     = 'style-' . ( $settings['badgeStyle'] ?? 'original' );
		$animation_class = $settings['animation'] ? self::get_animation_class( $settings['animation'] ) : '';

		// Get margin style if custom margin is enabled
		$margin_style = self::get_margin_style( $settings );

		// Get exact sizes
		$desktop_size = self::get_size_values( $settings['badgeSizeDesktop'] );
		$mobile_size  = self::get_size_values( $settings['badgeSizeMobile'] );

		// Start badge container without margin style
		$html  = '';
		$html .= '<div class="convers-trust-badges ' . esc_attr( $alignment_class ) . ' ' . esc_attr( $animation_class ) . '">';

		// Show header if enabled with exact settings
		if ( ! empty( $settings['showHeader'] ) ) {
			$html .= '<div class="trust-badges-header" style="';
			$html .= 'font-size: ' . esc_attr( $settings['fontSize'] ) . 'px;';
			$html .= 'color: ' . esc_attr( $settings['textColor'] ) . ';';
			$html .= 'text-align: ' . esc_attr( $settings['alignment'] ) . ';';
			if ( ! empty( $settings['customStyles'] ) ) {
				$html .= esc_attr( $settings['customStyles'] );
			}
			$html .= '">';
			$html .= esc_html( $settings['headerText'] );
			$html .= '</div>';
		}

		// Start badges wrapper
		$html .= '<div class="trust-badges-wrapper ' . esc_attr( $style_class ) . '" style="';
		$html .= 'display: flex;';
		$html .= 'flex-wrap: wrap;';
		$html .= 'gap: 10px;';
		$html .= 'justify-content: ' . self::get_alignment_style( $settings['badgeAlignment'] ?? 'center' ) . ';';
		$html .= 'align-items: stretch;';
		$html .= '">';

		// Display selected badges with exact settings
		if ( ! empty( $settings['selectedBadges'] ) ) {
			foreach ( $settings['selectedBadges'] as $index => $badge_id ) {
				$filename  = self::get_badge_filename( $badge_id );
				$badge_url = plugins_url( 'assets/images/badges/' . $filename, __DIR__ );

				// Add badge index and margin style to each badge container
				$html .= '<div class="badge-container" style="--badge-index: ' . esc_attr( $index ) . ';' . $margin_style . '">';

				if ( in_array( $settings['badgeStyle'], array( 'mono', 'mono-card' ) ) ) {
					$html .= '<div class="badge-image" style="';
					$html .= '-webkit-mask: url(' . esc_url( $badge_url ) . ') center/contain no-repeat;';
					$html .= 'mask: url(' . esc_url( $badge_url ) . ') center/contain no-repeat;';
					$html .= 'background-color: ' . esc_attr( $settings['badgeColor'] ) . ';';
					$html .= 'width: ' . esc_attr( $mobile_size ) . 'px;';
					$html .= 'height: ' . esc_attr( $mobile_size ) . 'px;';
					$html .= 'transition: all 0.3s ease;';
					$html .= '"></div>';
				} else {
					$html .= '<img src="' . esc_url( $badge_url ) . '" alt="converswp-trust-badge" class="badge-image" style="';  // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage
					$html .= 'width: ' . esc_attr( $mobile_size ) . 'px;';
					$html .= 'height: auto;';
					$html .= 'max-height: ' . esc_attr( $mobile_size ) . 'px;';
					$html .= 'transition: all 0.3s ease;';
					$html .= 'object-fit: contain;';
					$html .= '" />';
				}

				$html .= '</div>';
			}
		}

		$html .= '</div>'; // Close badges wrapper
		$html .= '</div>'; // Close badge container

		// Add responsive styles with exact sizes
		self::add_responsive_styles( $group_id, $settings );

		return $html;
	}

	/**
	 * Add responsive styles for badge sizes
	 */
	public static function add_responsive_styles( $group_id, $settings ) {
		$desktop_size = self::get_size_values( $settings['badgeSizeDesktop'] );
		$mobile_size  = self::get_size_values( $settings['badgeSizeMobile'] );
		$animation    = isset( $settings['animation'] ) ? $settings['animation'] : '';

		// Get design settings from database
		$badge_padding    = isset( $settings['badgePadding'] ) ? intval( $settings['badgePadding'] ) : 5;
		$badge_gap        = isset( $settings['badgeGap'] ) ? intval( $settings['badgeGap'] ) : 10;
		$container_margin = isset( $settings['containerMargin'] ) ? intval( $settings['containerMargin'] ) : 15;
		$border_radius    = isset( $settings['borderRadius'] ) ? intval( $settings['borderRadius'] ) : 4;
		$hover_transform  = isset( $settings['hoverTransform'] ) ? $settings['hoverTransform'] : 'translateY(-2px)';
		$transition       = isset( $settings['transition'] ) ? $settings['transition'] : 'all 0.3s ease';

		$html_id = '#convers-trust-badges-' . esc_attr($group_id);

		// Get animation styles based on settings
		$animation_styles = self::get_animation_styles( $html_id, $animation );
		
		$custom_css = '
        ' . esc_attr($html_id) . ' .convers-trust-badges {
            margin: ' . (int) $container_margin . 'px 0;
            width: 100%;
        }
        ' . esc_attr($html_id) . ' .trust-badges-wrapper {
            display: flex;
            flex-wrap: wrap;
            gap: ' . (int) $badge_gap . 'px;
            align-items: stretch;
            width: 100%;
        }
        ' . esc_attr($html_id) . ' .badge-container {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: ' . (int) $badge_padding . 'px;
            transition: ' . esc_attr( $transition ) . ';
        }

        /* Mobile styles */
        ' . esc_attr($html_id) . ' .badge-image {
            width: ' . (int) $mobile_size . 'px !important;
            height: auto !important;
            max-height: ' . (int) $mobile_size . 'px !important;
            transition: ' . esc_attr( $transition ) . ';
            object-fit: contain;
        }

        ' . esc_attr($html_id) . ' .style-mono .badge-image,
        ' . esc_attr($html_id) . ' .style-mono-card .badge-image {
            width: ' . (int) $mobile_size . 'px !important;
            height: ' . (int) $mobile_size . 'px !important;
            -webkit-mask-size: contain;
            mask-size: contain;
            -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
            -webkit-mask-position: center;
            mask-position: center;
            background-color: ' . esc_attr( $settings['badgeColor'] ) . ';
        }

        /* Desktop styles */
        @media screen and (min-width: 768px) {
            ' . esc_attr($html_id) . ' .badge-image {
                width: ' . (int) $desktop_size . 'px !important;
                max-height: ' . (int) $desktop_size . 'px !important;
            }
            
            ' . esc_attr($html_id) . ' .style-mono .badge-image,
            ' . esc_attr($html_id) . ' .style-mono-card .badge-image {
                width: ' . (int) $desktop_size . 'px !important;
                height: ' . (int) $desktop_size . 'px !important;
            }
        }

        /* Hover effects */
        ' . esc_attr($html_id) . ' .badge-container:hover {
            transform: ' . esc_attr( $hover_transform ) . ';
        }
        ' . esc_attr($html_id) . ' .badge-container:hover .badge-image {
            transform: scale(1.05);
        }

        /* Card styles */
        ' . esc_attr($html_id) . ' .style-card .badge-container,
        ' . esc_attr($html_id) . ' .style-mono-card .badge-container {
            background-color: #e5e7eb;
            padding: ' . ( (int) $badge_padding + 3 ) . 'px ' . ( (int) $badge_padding + 7 ) . 'px;
            border-radius: ' . (int) $border_radius . 'px;
        }

        /* Alignment */
        ' . esc_attr($html_id) . ' .align-left .trust-badges-wrapper { justify-content: flex-start; }
        ' . esc_attr($html_id) . ' .align-center .trust-badges-wrapper { justify-content: center; }
        ' . esc_attr($html_id) . ' .align-right .trust-badges-wrapper { justify-content: flex-end; }

        /* Animation styles */
        ' . wp_strip_all_tags( $animation_styles ) . '
        ';

		// Register and enqueue main styles
		wp_register_style(
			'trust-badges-main',
			plugins_url( 'assets/css/main.css', __DIR__ ),
			array(),
			TRUST_BADGES_VERSION
		);
		wp_enqueue_style( 'trust-badges-main' );

		// Add inline styles for this specific badge group
		wp_add_inline_style(
			'trust-badges-main',
			wp_strip_all_tags($custom_css)
		);
	}

	/**
	 * Convert size names to pixel values
	 */
	public static function get_size_values( $size ) {
		$sizes = array(
			'extra-small' => 32,
			'small'       => 48,
			'medium'      => 64,
			'large'       => 80,
		);

		return $sizes[ $size ] ?? 48;
	}

	/**
	 * Get alignment style value
	 */
	public static function get_alignment_style( $alignment ) {
		$styles = array(
			'left'   => 'flex-start',
			'center' => 'center',
			'right'  => 'flex-end',
		);
		return $styles[ $alignment ] ?? 'center';
	}

	/**
	 * Get margin style string if custom margins are enabled
	 */
	public static function get_margin_style( $settings ) {
		if ( empty( $settings['customMargin'] ) ) {
			return '';
		}

		$top    = isset( $settings['marginTop'] ) ? intval( $settings['marginTop'] ) : 0;
		$right  = isset( $settings['marginRight'] ) ? intval( $settings['marginRight'] ) : 0;
		$bottom = isset( $settings['marginBottom'] ) ? intval( $settings['marginBottom'] ) : 0;
		$left   = isset( $settings['marginLeft'] ) ? intval( $settings['marginLeft'] ) : 0;

		return sprintf(
			'margin: %dpx %dpx %dpx %dpx;',
			$top,
			$right,
			$bottom,
			$left
		);
	}

	/**
	 * Get animation class based on settings
	 */
	public static function get_animation_class( $animation ) {
		if ( empty( $animation ) ) {
			return '';
		}
		return 'badge-' . esc_attr( $animation );
	}

	/**
	 * Get animation styles based on settings
	 */
	public static function get_animation_styles( $html_id, $animation ) {
		if ( empty( $animation ) ) {
			return '';
		}

		$styles = '';

		// Base opacity for all animations
		$styles .= esc_attr($html_id) . ' .convers-trust-badges { opacity: 1; }';
		$styles .= esc_attr($html_id) . ' .badge-container { opacity: 0; }';

		// Animation definition based on type
		switch ( $animation ) {
			case 'fade':
				$styles .= esc_attr($html_id) . '
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
				$styles .= esc_attr($html_id) . '
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
				$styles .= esc_attr($html_id) . '
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
				$styles .= esc_attr($html_id) . '
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

	public static function get_badge_filename( $badge_id ) {
		$badgeJsonPath = TRUST_BADGES_PLUGIN_DIR . 'assets/badges.json';

		// now load file content as json
		$badges = json_decode( file_get_contents( $badgeJsonPath ), true );

		// now find the badge by id
		$badge = array_filter(
			$badges,
			function ( $item ) use ( $badge_id ) {
				return $item['id'] == $badge_id;
			}
		);

		// get image index of the badge
		$imagePath = array_values( $badge )[0]['image'];

		// now return the image name from imagePath
		return basename( $imagePath );
	}

	/**
	 * Helper method to sanitize and return position styles.
	 *
	 * @param string $position The alignment position.
	 * @return string Sanitized CSS value for justify-content.
	 */
	public static function get_position_style( $position ) {
		// Define allowed positions and their corresponding CSS values
		$allowed_positions = array(
			'left'   => 'flex-start',
			'center' => 'center',
			'right'  => 'flex-end',
		);

		// Return sanitized value or default to 'center' if invalid
		return $allowed_positions[ $position ] ?? 'center';
	}
}
