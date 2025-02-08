import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Checkbox } from "./ui/checkbox";
import { BadgeSelector } from "./BadgeSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "./ui/select";
import { PlayIcon, AlignCenter, AlignLeft, AlignRight, CheckCircle, Copy, HelpCircle, PlayCircle, PlusCircle, Trash2, Lock, Unlock, Check, PenSquare, X } from "lucide-react";
import { paymentBadges } from "./pages/assets/PaymentBadges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./ui/use-toast";
import { BadgeSize } from "../types/settings";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility function for merging class names
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
	interface Window {
		txBadgesSettings: {
			pluginUrl: string;
			ajaxUrl: string;
			nonce: string;
			restUrl: string;
			mediaTitle: string;
			mediaButton: string;
		};
	}
}

interface BadgeGroup {
	id: string;
	name: string;
	settings: TrustBadgesSettings;
	isDefault?: boolean;
	isActive?: boolean;
	requiredPlugin?: 'woocommerce' | 'edd';
}

// Add these utility functions at the top of the file
const toCamelCase = (str: string) => {
	return str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace("-", "").replace("_", ""));
};

const toSnakeCase = (str: string) => {
	return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

const convertKeysToSnakeCase = (obj: any): any => {
	if (typeof obj !== "object" || obj === null) return obj;

	if (Array.isArray(obj)) {
		return obj.map(convertKeysToSnakeCase);
	}

	return Object.keys(obj).reduce((acc, key) => {
		const snakeKey = toSnakeCase(key);
		acc[snakeKey] = convertKeysToSnakeCase(obj[key]);
		return acc;
	}, {} as any);
};

const convertKeysToCamelCase = (obj: any): any => {
	if (typeof obj !== "object" || obj === null) return obj;

	if (Array.isArray(obj)) {
		return obj.map(convertKeysToCamelCase);
	}

	return Object.keys(obj).reduce((acc, key) => {
		const camelKey = toCamelCase(key);
		acc[camelKey] = convertKeysToCamelCase(obj[key]);
		return acc;
	}, {} as any);
};

interface TrustBadgesSettings {
	showHeader: boolean;
	headerText: string;
	fontSize: string;
	alignment: "left" | "center" | "right";
	badgeAlignment: "left" | "center" | "right";
	position: "left" | "center" | "right";
	textColor: string;
	badgeStyle: "mono" | "original" | "mono-card" | "card";
	badgeSizeDesktop: BadgeSize;
	badgeSizeMobile: BadgeSize;
	badgeColor: string;
	customMargin: boolean;
	marginTop: string;
	marginBottom: string;
	marginLeft: string;
	marginRight: string;
	animation: "fade" | "slide" | "scale" | "bounce";
	showAfterAddToCart: boolean;
	showBeforeAddToCart: boolean;
	showOnCheckout: boolean;
	selectedBadges: string[];
}

const defaultSettings: TrustBadgesSettings = {
	showHeader: true,
	headerText: "Secure Checkout With",
	fontSize: "18",
	alignment: "center",
	badgeAlignment: "center",
	position: "center",
	textColor: "#000000",
	badgeStyle: "original",
	badgeSizeDesktop: "medium",
	badgeSizeMobile: "small",
	badgeColor: "#0066FF",
	customMargin: false,
	marginTop: "0",
	marginBottom: "0",
	marginLeft: "0",
	marginRight: "0",
	animation: "fade",
	showAfterAddToCart: false,
	showBeforeAddToCart: false,
	showOnCheckout: false,
	selectedBadges: ["mastercard", "visa-1", "paypal-1", "apple-pay", "stripe", "american-express-1"],
};

const defaultBadgeGroups: BadgeGroup[] = [
	{
		id: "woocommerce",
		name: "WooCommerce",
		isDefault: true,
		isActive: true,
		settings: { ...defaultSettings },
		requiredPlugin: 'woocommerce'
	},
	{
		id: "edd",
		name: "Easy Digital Downloads",
		isDefault: true,
		isActive: false,
		settings: {
			...defaultSettings,
			headerText: "Secure Payment Methods",
			alignment: "left",
		},
		requiredPlugin: 'edd'
	},
	{
		id: "footer",
		name: "Footer",
		isDefault: true,
		isActive: false,
		settings: {
			...defaultSettings,
			headerText: "Payment Options",
			alignment: "right",
		},
	},
];

export function Settings() {
	const [badgeGroups, setBadgeGroups] = useState<BadgeGroup[]>(defaultBadgeGroups);
	const [badgeSelectorOpen, setBadgeSelectorOpen] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [showCopied, setShowCopied] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
	const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
	const [originalName, setOriginalName] = useState<string>("");

	const { toast } = useToast();

	const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

	const [installedPlugins, setInstalledPlugins] = useState<{
		woocommerce: boolean;
		edd: boolean;
	}>({
		woocommerce: false,
		edd: false
	});

	useEffect(() => {
		const loadSettings = async () => {
			try {
				if (!window.txBadgesSettings?.ajaxUrl) {
					console.warn("txBadgesSettings not initialized");
					setIsLoading(false);
					return;
				}

				const formData = new FormData();
				formData.append("action", "tx_badges_get_settings");
				formData.append("nonce", window.txBadgesSettings.nonce || "");

				const response = await fetch(window.txBadgesSettings.ajaxUrl, {
					method: "POST",
					body: formData,
					credentials: "same-origin",
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const result = await response.json();

				if (!result.success) {
					throw new Error(result.data?.message || "Failed to load settings");
				}

				// Ensure we have valid data
				if (!result.data || typeof result.data !== "object") {
					throw new Error("Invalid settings data received");
				}

				// Convert snake_case to camelCase
				const camelCaseSettings = convertKeysToCamelCase(result.data);

				// Transform the loaded settings into our badge groups format
				const loadedSettings = Array.isArray(camelCaseSettings) ? camelCaseSettings : [camelCaseSettings];
				const transformedGroups = loadedSettings.map((settings) => ({
					id: settings.id || "default",
					name: settings.name || "Default",
					isDefault: false,
					isActive: true,
					settings: {
						showHeader: settings.show_header ?? defaultSettings.showHeader,
						headerText: settings.header_text ?? defaultSettings.headerText,
						fontSize: settings.font_size ?? defaultSettings.fontSize,
						alignment: settings.alignment ?? defaultSettings.alignment,
						badgeAlignment: settings.badge_alignment ?? defaultSettings.badgeAlignment,
						textColor: settings.text_color ?? defaultSettings.textColor,
						badgeStyle: settings.badge_style ?? defaultSettings.badgeStyle,
						badgeSizeDesktop: settings.badge_size_desktop ?? defaultSettings.badgeSizeDesktop,
						badgeSizeMobile: settings.badge_size_mobile ?? defaultSettings.badgeSizeMobile,
						badgeColor: settings.badge_color ?? defaultSettings.badgeColor,
						customMargin: settings.custom_margin ?? defaultSettings.customMargin,
						marginTop: settings.margin_top ?? defaultSettings.marginTop,
						marginBottom: settings.margin_bottom ?? defaultSettings.marginBottom,
						marginLeft: settings.margin_left ?? defaultSettings.marginLeft,
						marginRight: settings.margin_right ?? defaultSettings.marginRight,
						animation: settings.animation ?? defaultSettings.animation,
						showAfterAddToCart: settings.show_after_add_to_cart ?? defaultSettings.showAfterAddToCart,
						showBeforeAddToCart: settings.show_before_add_to_cart ?? defaultSettings.showBeforeAddToCart,
						showOnCheckout: settings.show_on_checkout ?? defaultSettings.showOnCheckout,
						selectedBadges: Array.isArray(settings.selected_badges) ? settings.selected_badges : defaultSettings.selectedBadges,
					},
				}));

				// If no settings were loaded, create a default group
				if (transformedGroups.length === 0) {
					transformedGroups.push({
						id: "default",
						name: "Default",
						isDefault: true,
						isActive: true,
						settings: { ...defaultSettings },
					});
				}

				setBadgeGroups(transformedGroups);
				setIsLoading(false);
			} catch (error) {
				console.error("Error loading settings:", error);
				toast({
					variant: "destructive",
					title: "Error loading settings",
					description: error instanceof Error ? error.message : "An unknown error occurred",
				});
				// Set default settings if loading fails
				setBadgeGroups(defaultBadgeGroups);
				setIsLoading(false);
			}
		};

		loadSettings();
	}, [toast]);

	const handleChange = (badgeGroupId: string, key: string, value: any) => {
		setBadgeGroups((prev) =>
			prev.map((group) => {
				if (group.id === badgeGroupId) {
					return { ...group, settings: { ...group.settings, [key]: value } };
				}
				return group;
			})
		);
		setHasUnsavedChanges(true);
	};

	// Handle position change for Footer
	const handlePositionChange = (badgeGroupId: string, position: "left" | "center" | "right") => {
		setBadgeGroups((prev) =>
			prev.map((group) => {
				if (group.id === badgeGroupId) {
					return { ...group, settings: { ...group.settings, position } };
				}
				return group;
			})
		);
		setHasUnsavedChanges(true);
	};

	const saveSettings = async () => {
		try {
			setIsLoading(true);

			// Check if txBadgesSettings is initialized
			if (!window.txBadgesSettings?.ajaxUrl) {
				throw new Error("txBadgesSettings not initialized");
			}

			// Debug: Log settings before save
			console.log("Saving settings:", badgeGroups);

			const formData = new FormData();
			formData.append("action", "tx_badges_save_settings");
			formData.append("nonce", window.txBadgesSettings.nonce || "");

			// Convert settings to snake_case before saving
			const snakeCaseSettings = convertKeysToSnakeCase(badgeGroups);

			formData.append("settings", JSON.stringify(snakeCaseSettings));

			const response = await fetch(window.txBadgesSettings.ajaxUrl, {
				method: "POST",
				credentials: "same-origin",
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.data?.message || "Failed to save settings");
			}

			setHasUnsavedChanges(false);
			toast({
				title: "Success",
				description: "Settings saved successfully",
				duration: 3000,
			});
		} catch (error) {
			console.error("Error saving settings:", error);
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to save settings",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleSaveBadges = (badgeGroupId: string, selectedBadges: string[]) => {
		handleChange(badgeGroupId, "selectedBadges", selectedBadges);
		setBadgeSelectorOpen(false);
	};

	const toggleAnimation = () => {
		setIsPlaying(true);
		setTimeout(() => setIsPlaying(false), 400); // 400ms = 0.4 seconds
	};

	const copyToClipboard = async (text: string) => {
		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
			} else {
				// Fallback for older browsers
				const textArea = document.createElement("textarea");
				textArea.value = text;
				textArea.style.position = "fixed";
				textArea.style.left = "-999999px";
				textArea.style.top = "-999999px";
				document.body.appendChild(textArea);
				textArea.focus();
				textArea.select();
				try {
					document.execCommand("copy");
					textArea.remove();
				} catch (err) {
					console.error("Failed to copy text:", err);
				}
			}
			setShowCopied(true);
			setTimeout(() => setShowCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	// Helper function to get size classes
	const getBadgeSize = (size: BadgeSize, isMobile = false) => {
		const sizes = {
			mobile: {
				"extra-small": "h-6 w-6",
				small: "h-8 w-8",
				medium: "h-10 w-10",
				large: "h-12 w-12",
			},
			desktop: {
				"extra-small": "h-8 w-8",
				small: "h-10 w-10",
				medium: "h-12 w-12",
				large: "h-16 w-16",
			},
		} as const;

		const sizeSet = isMobile ? sizes.mobile : sizes.desktop;
		return sizeSet[size] ?? sizeSet["medium"];
	};

	const getNextSequentialId = (groups: BadgeGroup[]) => {
		const customGroups = groups.filter(g => !g.isDefault);
		if (customGroups.length === 0) return "1";
		
		const ids = customGroups.map(g => {
			const num = parseInt(g.id);
			return isNaN(num) ? 0 : num;
		});
		
		return String(Math.max(...ids) + 1);
	};

	const addNewBadgeGroup = () => {
		const newId = getNextSequentialId(badgeGroups);
		const newGroup: BadgeGroup = {
			id: newId,
			name: `New Badge Group ${newId}`,
			settings: { ...defaultSettings },
			isDefault: false,
			isActive: true,
		};
		setBadgeGroups((prev) => [...prev, newGroup]);
		setHasUnsavedChanges(true);
	};

	const handleNameChange = (badgeGroupId: string, newName: string) => {
		setBadgeGroups((prev) =>
			prev.map((group) => {
				if (group.id === badgeGroupId) {
					return { ...group, name: newName };
				}
				return group;
			})
		);
		setHasUnsavedChanges(true);
	};

	const toggleBadgeGroupActive = (groupId: string) => {
		setBadgeGroups((prev) =>
			prev.map((group) => {
				if (group.id === groupId) {
					// If we're deactivating, also collapse the accordion
					if (group.isActive) {
						setActiveAccordion(null);
					}
					return { ...group, isActive: !group.isActive };
				}
				return group;
			})
		);
		setHasUnsavedChanges(true);
	};

	const handleDeleteGroup = (groupId: string) => {
		setBadgeGroups((prev) => prev.filter((b) => b.id !== groupId));
		setGroupToDelete(null);
		setHasUnsavedChanges(true);
	};

	const isPluginInstalled = (plugin?: 'woocommerce' | 'edd') => {
		if (!plugin) return true;
		return installedPlugins[plugin];
	};

	const getPluginWarning = (plugin?: 'woocommerce' | 'edd') => {
		if (!plugin || isPluginInstalled(plugin)) return null;
		
		const pluginInfo = {
			woocommerce: {
				name: 'WooCommerce',
				link: '/wp-admin/plugin-install.php?s=woocommerce&tab=search&type=term'
			},
			edd: {
				name: 'Easy Digital Downloads',
				link: '/wp-admin/plugin-install.php?s=easy-digital-downloads&tab=search&type=term'
			}
		};

		return (
			<div className="flex items-center text-red-500 text-sm">
				<span>{pluginInfo[plugin].name} is not installed. </span>
				<a 
					href={pluginInfo[plugin].link}
					className="ml-1 underline hover:text-red-600"
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => e.stopPropagation()}
				>
					Install now
				</a>
			</div>
		);
	};

	useEffect(() => {
		// Check installed plugins on component mount
		const checkInstalledPlugins = async () => {
			try {
				const response = await window.wp.apiFetch({
					path: '/tx-badges/v1/installed-plugins',
					method: 'GET'
				});
				
				console.log('Plugin check response:', response); // Debug log
				
				if (response && typeof response === 'object') {
					setInstalledPlugins({
						woocommerce: Boolean(response.woocommerce),
						edd: Boolean(response.edd)
					});
					console.log('Updated installed plugins state:', {
						woocommerce: Boolean(response.woocommerce),
						edd: Boolean(response.edd)
					});
				}
			} catch (error) {
				console.error('Failed to check installed plugins:', error);
				setInstalledPlugins({
					woocommerce: false,
					edd: false
				});
			}
		};

		checkInstalledPlugins();
	}, []);

	return (
		<div className="space-y-4">
			{isLoading ? (
				<div className="flex items-center justify-center min-h-[200px]">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			) : (
				<>
					<div className="flex justify-between items-center mb-8">
						<h1 className="text-xl font-bold">Badge Settings</h1>
						<Button onClick={addNewBadgeGroup} className="flex items-center gap-2">
							<PlusCircle className="w-4 h-4" />
							Add New Badge
						</Button>
					</div>

					<Accordion 
						type="single" 
						collapsible 
						className="space-y-4"
						value={activeAccordion || undefined}
						onValueChange={setActiveAccordion}
					>
						{badgeGroups.map((group) => (
							<AccordionItem 
								key={group.id} 
								value={group.id} 
								className={cn(
									"border rounded-lg overflow-hidden",
									!group.isActive && "opacity-60"
								)}
							>
								<div className="flex items-center justify-between px-4">
									<div className={cn(
										"flex-1 flex items-center py-4",
										!group.isActive && "cursor-not-allowed"
									)}>
										{!group.isDefault ? (
											<div className="flex items-center gap-2">
												<div className="flex items-center gap-4">
													{/* Lock/Unlock Icon */}
													{editingGroupId === group.id ? (
														<Unlock className="h-4 w-4 text-gray-300" />
													) : (
														<Lock className="h-4 w-4 text-gray-300" />
													)}

													{/* Name/Input Field */}
													{editingGroupId === group.id ? (
														<Input
															value={group.name}
															onChange={(e) => handleNameChange(group.id, e.target.value)}
															onClick={(e) => e.stopPropagation()}
															className={cn(
																!group.isActive && "cursor-not-allowed bg-muted"
															)}
															disabled={!group.isActive}
															autoFocus
														/>
													) : (
														<span className="font-mono text-sm text-gray-700">{group.name}</span>
													)}

													{/* Edit/Save Button */}
													{editingGroupId === group.id ? (
														<div className="flex items-center gap-2">
															<button
																onClick={() => setEditingGroupId(null)}
																className="p-0.5 hover:bg-gray-200 rounded-sm"
															>
																<Check className="h-4 w-4 text-gray-300" />
															</button>
															<button
																onClick={() => {
																	handleNameChange(group.id, originalName); // Reset to original name
																	setEditingGroupId(null);
																	setOriginalName("");
																}}
																className="p-0.5 hover:bg-gray-200 rounded-sm"
															>
																<X className="h-4 w-4 text-gray-300" />
															</button>
														</div>
													) : (
														<button
															onClick={() => {
																setOriginalName(group.name);
																setEditingGroupId(group.id);
															}}
															className="p-0.5 hover:bg-gray-200 rounded-sm"
														>
															<PenSquare className="h-4 w-4 text-gray-300" />
														</button>
													)}
												</div>
											</div>
										) : (
											<span className={cn(
												"font-medium",
												!group.isActive && "text-muted-foreground"
											)}>
												{group.name}
											</span>
										)}
									</div>
									
									<div className="flex items-center gap-8">
										{!group.isDefault && (
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={(e) => e.stopPropagation()}
													>
														<Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete Badge Group</AlertDialogTitle>
														<AlertDialogDescription>
															Are you sure you want to delete "{group.name}"? This action cannot be undone.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction 
															onClick={() => handleDeleteGroup(group.id)}
															className="bg-red-500 hover:bg-red-600"
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										)}

										{getPluginWarning(group.requiredPlugin)}

										<Switch
											checked={group.isActive} 
											onCheckedChange={() => toggleBadgeGroupActive(group.id)} 
											aria-label="Toggle badge group active state"
											onClick={(e) => e.stopPropagation()}
											disabled={!isPluginInstalled(group.requiredPlugin)}
										/>

										<AccordionTrigger 
											className="h-8 w-8 p-0"
											disabled={!group.isActive}
										/>
									</div>
								</div>

								<AccordionContent className={cn(
									!group.isActive && "pointer-events-none select-none"
								)}>
									<Separator className="my-4 bg-muted" />

									<div className="p-6">
										{/* Main Settings */}
										<div className="flex gap-12">
											{/* Left Section - Settings */}
											<div className="flex-1 space-y-12">
												{/* Header */}
												<div>
													<div className="flex items-center justify-between border-b">
														<h2 className="text-base font-semibold pb-2">Header Settings</h2>
														<Switch checked={group.settings.showHeader} onCheckedChange={(checked) => handleChange(group.id, "showHeader", checked)} />
													</div>
													<div className="space-y-5">
														<div className="flex flex-col gap-4">
															{/* Header text and font size */}
															<div className="space-y-4 mt-4">
																<div className="space-y-2">
																	<Label className={`font-medium block ${!group.settings.showHeader ? "opacity-50" : ""}`}>Header text</Label>
																	<Input
																		value={group.settings.headerText}
																		onChange={(e) => handleChange(group.id, "headerText", e.target.value)}
																		disabled={!group.settings.showHeader}
																		className={!group.settings.showHeader ? "opacity-50 cursor-not-allowed" : ""}
																	/>
																</div>
															</div>

															{/* Style Controls - Inline */}
															<div className="flex items-center gap-8">
																{/* Font Size */}
																<div className="space-y-2">
																	<Label className={`font-medium block ${!group.settings.showHeader ? "opacity-50" : ""}`}>Font Size (px)</Label>
																	<Input
																		type="number"
																		value={group.settings.fontSize}
																		onChange={(e) => handleChange(group.id, "fontSize", e.target.value)}
																		className={`w-[150px] ${!group.settings.showHeader ? "opacity-50 cursor-not-allowed" : ""}`}
																		disabled={!group.settings.showHeader}
																	/>
																</div>

																{/* Alignment */}
																<div className="space-y-2">
																	<Label className={`font-medium block ${!group.settings.showHeader ? "opacity-50" : ""}`}>Alignment</Label>
																	<div className={`flex gap-2 border rounded-md p-1 w-[150px] ${!group.settings.showHeader ? "opacity-50" : ""}`}>
																		<Button
																			variant={group.settings.alignment === "left" ? "default" : "ghost"}
																			size="sm"
																			onClick={() => handleChange(group.id, "alignment", "left")}
																			className="h-8 w-10"
																			disabled={!group.settings.showHeader}>
																			<AlignLeft />
																		</Button>
																		<Button
																			variant={group.settings.alignment === "center" ? "default" : "ghost"}
																			size="sm"
																			onClick={() => handleChange(group.id, "alignment", "center")}
																			className="h-8 w-10"
																			disabled={!group.settings.showHeader}>
																			<AlignCenter />
																		</Button>
																		<Button
																			variant={group.settings.alignment === "right" ? "default" : "ghost"}
																			size="sm"
																			onClick={() => handleChange(group.id, "alignment", "right")}
																			className="h-8 w-10"
																			disabled={!group.settings.showHeader}>
																			<AlignRight />
																		</Button>
																	</div>
																</div>

																{/* Text Color */}
																<div className="space-y-2">
																	<Label className={`font-medium block ${!group.settings.showHeader ? "opacity-50" : ""}`}>Color</Label>
																	<div className={`flex items-center p-2 border w-[50px] h-[42px] rounded-md bg-white ${!group.settings.showHeader ? "opacity-50" : ""}`}>
																		<Input
																			type="color"
																			value={group.settings.textColor}
																			onChange={(e) => handleChange(group.id, "textColor", e.target.value)}
																			className="w-11 h-8 p-0 border-0"
																			disabled={!group.settings.showHeader}
																		/>
																	</div>
																</div>
															</div>
														</div>
													</div>
												</div>

												{/* Badge Placement */}
												<div className="">
													<div className="">
														<h2 className="text-lg font-semibold mb-6 border-b pb-2">Badge Placement</h2>
														<div className="space-y-6">
															<div className="space-y-4">
																{/* Show different options based on group type */}
																{group.id === "footer" ? (
																	<>
																		<h4 className="text-sm font-medium mb-4">Badge Position:</h4>
																		<div className="flex flex-col gap-4">
																			{/* Position Left */}
																			<div className="flex items-center gap-2">
																				<input
																					type="radio"
																					id="position-left"
																					name="badge-position"
																					checked={group.settings.position === "left"}
																					onChange={() => handlePositionChange(group.id, "left")}
																					className="w-4 h-4"
																				/>
																				<Label htmlFor="position-left">Left</Label>
																			</div>

																			{/* Position Center */}
																			<div className="flex items-center gap-2">
																				<input
																					type="radio"
																					id="position-center"
																					name="badge-position"
																					checked={group.settings.position === "center"}
																					onChange={() => handlePositionChange(group.id, "center")}
																					className="w-4 h-4"
																				/>
																				<Label htmlFor="position-center">Center</Label>
																			</div>

																			{/* Position Right */}
																			<div className="flex items-center gap-2">
																				<input
																					type="radio"
																					id="position-right"
																					name="badge-position"
																					checked={group.settings.position === "right"}
																					onChange={() => handlePositionChange(group.id, "right")}
																					className="w-4 h-4"
																				/>
																				<Label htmlFor="position-right">Right</Label>
																			</div>
																		</div>
																	</>
																) : group.requiredPlugin ? (
																	<>
																		<h4 className="text-sm font-medium mb-4">Show badge on:</h4>
																		<div className="space-y-4">
																			{/* After add to cart button */}
																			<div className="flex items-center justify-between">
																				<div className="flex items-center gap-2">
																					<Checkbox 
																						id="show-after-add-to-cart" 
																						checked={group.settings.showAfterAddToCart} 
																						onCheckedChange={(checked) => handleChange(group.id, "showAfterAddToCart", checked)} 
																					/>
																					<Label htmlFor="show-after-add-to-cart" className="text-sm">
																						After add to cart button
																					</Label>
																				</div>
																				<TooltipProvider>
																					<Tooltip>
																						<TooltipTrigger asChild>
																							<Button variant="ghost" size="icon" className="h-5 w-5">
																								<HelpCircle className="h-5 w-5 text-muted-foreground" />
																							</Button>
																						</TooltipTrigger>
																						<TooltipContent>
																							<p className="w-[200px] text-xs">Display the trust badges below the Add to Cart button on product pages</p>
																						</TooltipContent>
																					</Tooltip>
																				</TooltipProvider>
																			</div>

																			{/* Before add to cart button */}
																			<div className="flex items-center justify-between">
																				<div className="flex items-center gap-2">
																					<Checkbox 
																						id="show-before-add-to-cart" 
																						checked={group.settings.showBeforeAddToCart} 
																						onCheckedChange={(checked) => handleChange(group.id, "showBeforeAddToCart", checked)} 
																					/>
																					<Label htmlFor="show-before-add-to-cart" className="text-sm">
																						Before add to cart button
																					</Label>
																				</div>
																				<TooltipProvider>
																					<Tooltip>
																						<TooltipTrigger asChild>
																							<Button variant="ghost" size="icon" className="h-5 w-5">
																								<HelpCircle className="h-5 w-5 text-muted-foreground" />
																							</Button>
																						</TooltipTrigger>
																						<TooltipContent>
																							<p className="w-[200px] text-xs">Display the trust badges above the Add to Cart button on product pages</p>
																						</TooltipContent>
																					</Tooltip>
																				</TooltipProvider>
																			</div>

																			{/* Checkout page */}
																			<div className="flex items-center justify-between">
																				<div className="flex items-center gap-2">
																					<Checkbox 
																						id="show-on-checkout" 
																						checked={group.settings.showOnCheckout} 
																						onCheckedChange={(checked) => handleChange(group.id, "showOnCheckout", checked)} 
																					/>
																					<Label htmlFor="show-on-checkout" className="text-sm">
																						Checkout page
																					</Label>
																				</div>
																				<TooltipProvider>
																					<Tooltip>
																						<TooltipTrigger asChild>
																							<Button variant="ghost" size="icon" className="h-5 w-5">
																								<HelpCircle className="h-5 w-5 text-muted-foreground" />
																							</Button>
																						</TooltipTrigger>
																						<TooltipContent>
																							<p className="w-[200px] text-xs">Display the trust badges on the checkout page</p>
																						</TooltipContent>
																					</Tooltip>
																				</TooltipProvider>
																			</div>
																		</div>
																	</>
																) : (
																	<div className="space-y-2">
																		<p className="text-sm">
																			Use this shortcode to display the badges in a custom location:
																		</p>
																		<div className="relative">
																			<div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">{`<div class="convers-trust-badge-${group.id}"></div>`}</div>
																			<div className="absolute right-2 top-1.5 flex gap-1">
																				<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(`<div class="convers-trust-badge-${group.id}"></div>`)}>
																					{showCopied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-primary hover:text-primary/80" />}
																				</Button>
																			</div>
																			<AnimatePresence>
																				{showCopied && (
																					<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-full mt-2 text-center z-10">
																						<span className="inline-flex items-center gap-1 rounded-md bg-black/80 px-4 py-3 text-sm text-white">
																							<CheckCircle className="h-4 mr-1 text-green-500" /> Shortcode copied to clipboard
																						</span>
																					</motion.div>
																				)}
																			</AnimatePresence>
																		</div>
																	</div>
																)}

																<div className="space-y-2">
																	<p className="text-sm font-medium">Need help?</p>
																	<div className="flex items-center gap-4">
																		<Button variant="link" className="h-auto p-0 text-sm text-blue-600 hover:text-blue-700" asChild>
																			<a href="#" className="flex items-center gap-2">
																				<PlayCircle />
																				Step by Step Guide
																			</a>
																		</Button>
																	</div>
																</div>
															</div>
														</div>
													</div>
												</div>
											</div>

											<Separator orientation="vertical" className="bg-muted h-auto" />

											{/* Right Section - Bar Preview */}
											<div className="w-[60%] top-6 self-start space-y-12">
												{/* Badges */}
												<div className="">
													<h2 className="text-base font-semibold border-b pb-2 mb-4">Badge Settings</h2>
													<div className="space-y-8">
														<div className="flex flex-col gap-4">
															{/* Badge Style */}
															<div className="space-y-2">
																<div className="grid grid-cols-4 gap-8">
																	{[
																		{ id: "original", label: "Original" },
																		{ id: "card", label: "Card" },
																		{ id: "mono", label: "Mono" },
																		{ id: "mono-card", label: "Mono Card" },
																	].map((style) => (
																		<button
																			key={style.id}
																			onClick={() => handleChange(group.id, "badgeStyle", style.id)}
																			className={`border rounded-lg p-2 flex flex-col items-center transition-colors ${
																				group.settings.badgeStyle === style.id ? "border-primary bg-primary/5" : "border-input hover:border-primary/50"
																			}`}>
																		<div className={`w-10 h-8 rounded flex items-center justify-center ${style.id.includes("card") ? "bg-gray-400 shadow-sm py-1 px-2" : "p-1"}`}>
																			<img
																				src={`${window.txBadgesSettings.pluginUrl}assets/images/badges/mastercard_color.svg`}
																				alt="Badge Style Preview"
																				className={`w-full h-full object-contain ${style.id.includes("mono") ? "grayscale" : ""}`}
																			/>
																		</div>
																		<span className="text-xs font-medium">{style.label}</span>
																	</button>
																))}
																</div>
															</div>

															{/* Alignment, Size, Color */}
															<div className="space-y-2 flex items-start gap-8">
																{/* Badge Alignment */}
																<div className="space-y-2">
																	<Label className="font-medium block">Alignment</Label>
																	<div className="flex gap-2 border rounded-md p-1 w-[150px]">
																		<Button
																			variant={group.settings.badgeAlignment === "left" ? "default" : "ghost"}
																			size="sm"
																			onClick={() => handleChange(group.id, "badgeAlignment", "left")}
																			className="h-8 w-10">
																			<AlignLeft />
																		</Button>
																		<Button
																			variant={group.settings.badgeAlignment === "center" ? "default" : "ghost"}
																			size="sm"
																			onClick={() => handleChange(group.id, "badgeAlignment", "center")}
																			className="h-8 w-10">
																			<AlignCenter />
																		</Button>
																		<Button
																			variant={group.settings.badgeAlignment === "right" ? "default" : "ghost"}
																			size="sm"
																			onClick={() => handleChange(group.id, "badgeAlignment", "right")}
																			className="h-8 w-10">
																			<AlignRight />
																		</Button>
																	</div>
																</div>

																{/* Combined Badge Size Dropdown */}
																<div className="space-y-2" style={{ marginTop: 0 }}>
																	<Label className="font-medium block">Size</Label>
																	<Select
																		value={[group.settings.badgeSizeDesktop, group.settings.badgeSizeMobile].join(',')}
																		onValueChange={(value) => {
																			const [desktop, mobile] = value.split(',');
																			if (desktop) handleChange(group.id, "badgeSizeDesktop", desktop);
																			if (mobile) handleChange(group.id, "badgeSizeMobile", mobile);
																		}}>
																		<SelectTrigger className="w-[250px]">
																			<SelectValue>
																				{`[D] ${group.settings.badgeSizeDesktop?.charAt(0).toUpperCase()}${group.settings.badgeSizeDesktop?.slice(1)}, [M] ${group.settings.badgeSizeMobile?.charAt(0).toUpperCase()}${group.settings.badgeSizeMobile?.slice(1)}`}
																			</SelectValue>
																		</SelectTrigger>
																		<SelectContent>
																			<SelectGroup>
																				<SelectLabel>Desktop Size [D]</SelectLabel>
																				<SelectItem value={`extra-small,${group.settings.badgeSizeMobile}`}>Extra Small</SelectItem>
																				<SelectItem value={`small,${group.settings.badgeSizeMobile}`}>Small</SelectItem>
																				<SelectItem value={`medium,${group.settings.badgeSizeMobile}`}>Medium</SelectItem>
																				<SelectItem value={`large,${group.settings.badgeSizeMobile}`}>Large</SelectItem>
																			</SelectGroup>
																			<SelectSeparator />
																			<SelectGroup>
																				<SelectLabel>Mobile Size [M]</SelectLabel>
																				<SelectItem value={`${group.settings.badgeSizeDesktop},extra-small`}>Extra Small</SelectItem>
																				<SelectItem value={`${group.settings.badgeSizeDesktop},small`}>Small</SelectItem>
																				<SelectItem value={`${group.settings.badgeSizeDesktop},medium`}>Medium</SelectItem>
																				<SelectItem value={`${group.settings.badgeSizeDesktop},large`}>Large</SelectItem>
																			</SelectGroup>
																		</SelectContent>
																	</Select>
																</div>

																{/* Badge Color */}
																<div className="space-y-2" style={{ marginTop: 0 }}>
																	<Label className="font-medium block">Color</Label>
																	<div className={`flex items-center p-2 border w-[50px] h-[42px] rounded-md bg-white ${!group.settings.showHeader ? "opacity-50" : ""}`}>
																		<Input
																			type="color"
																			value={group.settings.badgeColor}
																			onChange={(e) => handleChange(group.id, "badgeColor", e.target.value)}
																			className="w-11 h-8 p-0 border-0"
																		/>
																	</div>
																</div>
															</div>

															{/* Custom Margin */}
															<div className="space-y-4">
																<div className="flex items-center justify-between">
																	<Label className="font-medium">Custom Margin</Label>
																	<Switch checked={group.settings.customMargin} onCheckedChange={(checked) => handleChange(group.id, "customMargin", checked)} />
																</div>

																{group.settings.customMargin && (
																	<div className="" style={{ marginTop: 5 }}>
																		<div className="flex items-center gap-4">
																			<div className="flex items-center gap-2">
																				<Label className="font-medium min-w-[35px]">Top</Label>
																				<Input
																					type="number"
																					value={group.settings.marginTop}
																					onChange={(e) => handleChange(group.id, "marginTop", e.target.value)}
																					className="w-[60px] h-10"
																				/>
																			</div>

																			<div className="flex items-center gap-2">
																				<Label className="font-medium min-w-[35px]">Right</Label>
																				<Input
																					type="number"
																					value={group.settings.marginRight}
																					onChange={(e) => handleChange(group.id, "marginRight", e.target.value)}
																					className="w-[60px] h-10"
																				/>
																			</div>

																			<div className="flex items-center gap-2">
																				<Label className="font-medium min-w-[35px]">Bottom</Label>
																				<Input
																					type="number"
																					value={group.settings.marginBottom}
																					onChange={(e) => handleChange(group.id, "marginBottom", e.target.value)}
																					className="w-[60px] h-10"
																				/>
																			</div>

																			<div className="flex items-center gap-2">
																				<Label className="font-medium min-w-[35px]">Left</Label>
																				<Input
																					type="number"
																					value={group.settings.marginLeft}
																					onChange={(e) => handleChange(group.id, "marginLeft", e.target.value)}
																					className="w-[60px] h-10"
																				/>
																			</div>
																		</div>
																	</div>
																)}
															</div>
														</div>
													</div>
												</div>

												{/* Bar Preview Header with Animation Controls */}
												<Card>
													<div className="flex items-center justify-between pt-6 mb-4 px-6">
														<h2 className="text-lg font-semibold">Bar Preview</h2>
														<div className="flex items-center gap-4">
															<div className="flex items-center gap-2">
																<Label className="font-medium">Animation</Label>
																<Select value={group.settings.animation} onValueChange={(value) => handleChange(group.id, "animation", value)}>
																	<SelectTrigger className="w-[130px]">
																		<SelectValue placeholder="Select animation" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="fade">Fade</SelectItem>
																		<SelectItem value="slide">Slide</SelectItem>
																		<SelectItem value="scale">Scale</SelectItem>
																		<SelectItem value="bounce">Bounce</SelectItem>
																	</SelectContent>
																</Select>
															</div>
															<Button variant="outline" onClick={toggleAnimation} disabled={isPlaying}>
																<PlayIcon className="h-4 w-4 mr-2" />
																{isPlaying ? "Playing..." : "Play"}
															</Button>
														</div>
													</div>

													<div
														className="px-48 py-6 space-y-4 bg-gray-100 mt-6"
														style={{
															fontSize: `${group.settings.fontSize}px`,
															textAlign: group.settings.alignment as any,
															color: group.settings.textColor,
															marginTop: group.settings.customMargin ? `${group.settings.marginTop}px` : undefined,
															marginBottom: group.settings.customMargin ? `${group.settings.marginBottom}px` : undefined,
															marginLeft: group.settings.customMargin ? `${group.settings.marginLeft}px` : undefined,
															marginRight: group.settings.customMargin ? `${group.settings.marginRight}px` : undefined,
														}}>
														{group.settings.showHeader && group.settings.headerText}
														<AnimatePresence>
															<motion.div
																className="flex flex-wrap gap-4 mt-2"
																initial={false}
																animate={
																	isPlaying
																		? {
																				opacity: group.settings.animation === "fade" ? [0, 1] : 1,
																				x: group.settings.animation === "slide" ? [-100, 0] : 0,
																				scale: group.settings.animation === "scale" ? [0, 1] : 1,
																				y: group.settings.animation === "bounce" ? [-20, 0] : 0,
																	  }
																		: {}
																}
																transition={{
																	duration: 0.4,
																	ease: group.settings.animation === "bounce" ? "easeOut" : "easeInOut",
																	repeat: isPlaying ? 0 : 0,
																}}
																style={{
																	display: "flex",
																	flexWrap: "wrap",
																	gap: "1.2rem",
																	justifyContent: group.settings.badgeAlignment === "left" ? "flex-start" : group.settings.badgeAlignment === "right" ? "flex-end" : "center",
																}}>
																{group.settings.selectedBadges.map((badgeId) => {
																	const badge = paymentBadges.find((b) => b.id === badgeId);
																	return badge ? (
																		<img
																			key={badgeId}
																			src={badge.image}
																			alt={badge.name}
																			className={`object-contain 
																				${getBadgeSize(group.settings.badgeSizeDesktop as BadgeSize)} 
																				md:${getBadgeSize(group.settings.badgeSizeDesktop as BadgeSize)} 
																				${getBadgeSize(group.settings.badgeSizeMobile as BadgeSize, true)}
																				${group.settings.badgeStyle === "card" || group.settings.badgeStyle === "mono-card" ? "px-2 bg-gray-400 rounded text-white" : ""}`}
																			style={{
																				filter: group.settings.badgeStyle === "mono" || group.settings.badgeStyle === "mono-card" ? "grayscale(100%)" : "none",
																			}}
																		/>
																	) : null;
																})}
															</motion.div>
														</AnimatePresence>
													</div>
													
													<div className="p-6 pt-0 text-center pt-4">
														<Button onClick={() => setBadgeSelectorOpen(true)}>Select Badges</Button>
													</div>
												</Card>
											</div>
										</div>

										{/* Badge Selector Modal */}
										<BadgeSelector
											open={badgeSelectorOpen}
											onOpenChange={setBadgeSelectorOpen}
											badges={paymentBadges}
											initialSelected={group.settings.selectedBadges}
											onSave={(selectedBadges) => handleSaveBadges(group.id, selectedBadges)}
										/>
									</div>
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>

					{/* Sticky Save Button */}
					<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex justify-end">
						<Button
							onClick={saveSettings}
							disabled={!hasUnsavedChanges || isLoading}
							className={`${hasUnsavedChanges ? "bg-primary hover:bg-primary/90" : "bg-gray-200"}`}
						>
							{isLoading ? (
								<div className="flex items-center gap-2">
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
									Saving...
								</div>
							) : hasUnsavedChanges ? (
								"Save Changes"
							) : (
								"All Changes Saved"
							)}
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
