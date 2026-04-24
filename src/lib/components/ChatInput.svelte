<script lang="ts">
	import { fade } from "svelte/transition";
	import { SIIcon } from "@willingtonortiz/svelte-simple-icons";
	import { siGmail, siGoogledrive, siGooglecalendar } from "simple-icons";
	import {
		Plus,
		Mic,
		ArrowUp,
		SlidersHorizontal,
		Sparkles,
		X,
	} from "lucide-svelte";
	let {
		value = $bindable(""),
		placeholder = "Ask Orkestrate",
		onsend,
		compact = false,
		disabled = false,
	} = $props<{
		value?: string;
		placeholder?: string;
		onsend?: (msg: string) => void;
		compact?: boolean;
		disabled?: boolean;
	}>();
	let element: HTMLTextAreaElement;
	let showConnectBar = $state(true);
	function autoResize() {
		if (!element) return;
		element.style.height = "auto";
		element.style.height = Math.min(element.scrollHeight, 200) + "px";
	}
	function handleInput() {
		value = element.value;
		autoResize();
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey && !disabled) {
			e.preventDefault();
			send();
		}
	}
	function send() {
		if (disabled) return;
		const trimmed = value.trim();
		if (!trimmed) return;
		onsend?.(trimmed);
		value = "";
		if (element) {
			element.value = "";
			element.style.height = "auto";
		}
	}
	export function focus() {
		element?.focus();
	}
	$effect(() => {
		if (value === "" && element) {
			element.value = "";
			element.style.height = "auto";
		}
	});
</script>

<div class="w-full max-w-[760px] mx-auto">
	<!-- Unified Input Container -->
	<div
		class="relative flex flex-col bg-[var(--chat-input-bg)] rounded-2xl border border-[var(--chat-input-border)] transition-all duration-200"
	>
		<!-- Textarea -->
		<textarea
			bind:this={element}
			{placeholder}
			oninput={handleInput}
			onkeydown={handleKeydown}
			spellcheck="false"
			disabled={disabled}
			class="w-full bg-transparent border-none outline-none text-[var(--fg)] text-[var(--font-size-md)] leading-[1.5] tracking-[-0.01em] resize-none overflow-hidden px-4 pt-4 pb-2 placeholder:text-[#6B6B6B] selection:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
			style="min-height: 64px;"
		></textarea>
		<!-- Bottom Toolbar -->
		<div class="flex justify-between items-center px-4 pb-4 pt-1">
			<!-- Left tools: Bordered Chips -->
			<div class="flex items-center gap-2">
				<button
					class="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#8a8a8a] hover:text-[#e0e0e0] hover:bg-white/[0.05] transition-all duration-150"
					title="Attach"
				>
					<Plus size={18} strokeWidth={1.5} />
				</button>
				<button
					class="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#8a8a8a] hover:text-[#e0e0e0] hover:bg-white/[0.05] transition-all duration-150"
					title="Settings"
				>
					<SlidersHorizontal size={18} strokeWidth={1.5} />
				</button>
				<button
					class="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#8a8a8a] hover:text-[#e0e0e0] hover:bg-white/[0.05] transition-all duration-150"
					title="Enhance"
				>
					<Sparkles size={18} strokeWidth={1.5} />
				</button>
			</div>

			<!-- Right: Mic + Send -->
			<div class="flex items-center gap-3">
				<button
					class="p-1.5 rounded-lg text-[#8a8a8a] hover:text-[#e0e0e0] hover:bg-white/[0.05] transition-colors duration-150"
					title="Voice"
				>
					<Mic size={20} strokeWidth={1.5} />
				</button>

				<button
					onclick={send}
					disabled={disabled}
					class="w-10 h-10 flex items-center justify-center rounded-full bg-[#d0d0d0] text-[#121214] hover:bg-white transition-all duration-150 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
					title="Send message"
				>
					<ArrowUp size={22} strokeWidth={2.5} />
				</button>
			</div>
		</div>

		{#if showConnectBar && !compact}
			<div
				class="flex items-center justify-between px-5 py-3 border-t border-white/[0.04]"
				transition:fade={{ duration: 150 }}
			>
				<span
					class="text-[13px] font-normal text-[#8a8a8a] tracking-tight"
					>Connect your apps to get better answers</span
				>
				<div class="flex items-center gap-3">
					<!-- Brand Icons -->
					<div class="flex items-center gap-3.5">
						<SIIcon icon={siGmail} color="#EA4335" size={16} />
						<SIIcon
							icon={siGoogledrive}
							color="#4285F4"
							size={16}
						/>
						<SIIcon
							icon={siGooglecalendar}
							color="#FBBC04"
							size={16}
						/>
					</div>
					<button
						onclick={() => (showConnectBar = false)}
						class="p-0.5 rounded text-[#5a5a5a] hover:text-[#9a9a9a] transition-colors"
					>
						<X size={14} strokeWidth={2} />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
