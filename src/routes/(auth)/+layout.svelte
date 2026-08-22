<script lang="ts">
import { instanceName } from '$lib/auth/client'

let { children } = $props()
</script>

<div class="grid min-h-dvh place-items-center bg-[var(--kern-canvas)] p-6">
  <div class="w-full max-w-[400px]">
    <div class="mb-7 flex items-center justify-center gap-2.5">
      <div class="flex h-9 w-9 items-center justify-center gap-[3px] rounded-[10px] bg-[var(--kern-ink-900)]">
        <span class="text-[16px] font-semibold leading-none tracking-[-0.03em] text-[var(--kern-ink-inverse)]">K</span>
        <span class="h-3.5 w-0.5 rounded-[1px] bg-[var(--kern-accent)]"></span>
      </div>
      <span class="text-[15px] font-semibold tracking-[-0.015em] text-[var(--kern-ink-900)]">
        {instanceName()}
      </span>
    </div>
    {@render children()}
  </div>
</div>
