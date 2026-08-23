<script lang="ts">
import { page } from '$app/state'
import { isProjectSection } from './nav'
import ComponentsPage from './project/ComponentsPage.svelte'
import CyclesPage from './project/CyclesPage.svelte'
import MilestonesPage from './project/MilestonesPage.svelte'
import TemplatesPage from './project/TemplatesPage.svelte'

/**
 * One project's pages, chosen by the last segment of the URL.
 *
 * Each section is a screen of its own rather than a tab: `/tracker/projects/KRN/milestones` is where
 * a release is planned, `/tracker/projects/KRN/components` is where the system is named. The sidebar
 * is what moves between them, so the pages do not have to carry a switcher as well.
 */
const section = $derived(isProjectSection(page.params.section) ? page.params.section : 'components')
</script>

{#if section === 'milestones'}
  <MilestonesPage />
{:else if section === 'cycles'}
  <CyclesPage />
{:else if section === 'templates'}
  <TemplatesPage />
{:else}
  <ComponentsPage />
{/if}
