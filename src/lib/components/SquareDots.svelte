<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
    let animationId: number;
    let time = 0;

    const dotCount = 6;
    const dotSize = 2.5;
    const speed = 0.015;

    onMount(() => {
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = 20 * dpr;
        canvas.height = 20 * dpr;
        canvas.style.width = "20px";
        canvas.style.height = "20px";
        ctx.scale(dpr, dpr);

        animate();
    });

    onDestroy(() => {
        if (animationId) cancelAnimationFrame(animationId);
    });

    function animate() {
        if (!ctx) return;

        ctx.clearRect(0, 0, 20, 20);

        const padding = 3.5;
        const size = 20 - padding * 2;
        const perimeter = size * 4;

        for (let i = 0; i < dotCount; i++) {
            const t = ((time + i / dotCount) % 1 + 1) % 1;
            const distance = t * perimeter;
            const { x, y } = getPositionOnSquare(distance, padding, size);

            const alpha = 0.3 + 0.5 * Math.sin(t * Math.PI);

            ctx.beginPath();
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(130, 130, 130, ${alpha})`;
            ctx.fill();
        }

        time += speed;
        animationId = requestAnimationFrame(animate);
    }

    function getPositionOnSquare(distance: number, padding: number, size: number) {
        let x: number, y: number;

        if (distance < size) {
            x = padding + distance;
            y = padding;
        } else if (distance < size * 2) {
            x = padding + size;
            y = padding + (distance - size);
        } else if (distance < size * 3) {
            x = padding + size - (distance - size * 2);
            y = padding + size;
        } else {
            x = padding;
            y = padding + size - (distance - size * 3);
        }

        return { x, y };
    }
</script>

<canvas bind:this={canvas} class="inline-block"></canvas>
