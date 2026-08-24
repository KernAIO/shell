import { defineClientModule } from '@kernhq/ui'
import * as m from '$msg'
import { QUIRE_PERMISSIONS } from './permissions'

/**
 * Quire as the shell sees it.
 *
 * The sidebar is a search box and a page tree rather than a "New page" button, because the sidebar
 * belongs to the module you are in and a wiki's sidebar is its table of contents (DESIGN.md §2.3).
 * Creating a page happens where you are standing — at the space, or under the page you are reading.
 *
 * Labels are getters because a module is defined once at import time while the interface language
 * can change afterwards; reading them on render keeps the rail in the language actually chosen.
 */
export const quireClientModule = defineClientModule({
  id: 'quire',
  name: 'Quire',
  icon: 'scroll-text',

  nav: [
    {
      id: 'quire',
      get label() {
        return m.quire_nav()
      },
      icon: 'scroll-text',
      href: '/quire',
      order: 40,
      permission: QUIRE_PERMISSIONS.spaceView,
    },
  ],

  routes: [
    {
      path: '/quire',
      component: () => import('./SpacesPage.svelte'),
      get title() {
        return m.quire_title()
      },
      permission: QUIRE_PERMISSIONS.spaceView,
    },
  ],

  commands: [
    {
      id: 'quire.open',
      get label() {
        return m.quire_cmd_open()
      },
      icon: 'scroll-text',
      permission: QUIRE_PERMISSIONS.spaceView,
      run: (ctx) => ctx.navigate('/quire'),
    },
    {
      id: 'quire.new-space',
      get label() {
        return m.quire_cmd_new_space()
      },
      icon: 'plus',
      permission: QUIRE_PERMISSIONS.spaceManage,
      run: (ctx) => ctx.navigate('/quire?new=1'),
    },
  ],

  sidebar: [
    {
      id: 'quire',
      match: ['quire'],
      permission: QUIRE_PERMISSIONS.spaceView,
      component: () => import('./components/SidebarSpaces.svelte'),
    },
  ],

  presenters: [
    {
      type: 'page',
      inline: () => import('./components/PageInline.svelte'),
      page: (id, workspaceSlug) => `/${workspaceSlug}/quire/p/${encodeURIComponent(id)}`,
    },
  ],
})

export default quireClientModule
