import { defineClientModule } from '@kernhq/ui'
import * as m from '$msg'

/**
 * Core as the shell sees it.
 *
 * No navigation and no routes: core's screens are the shell's own — the inbox, settings, the admin
 * console — so the only thing it contributes is the set of dashboard widgets that are about the
 * platform rather than about any one module. Core is always enabled, so these are the widgets every
 * workspace has whatever else it has switched off.
 *
 * Titles are getters because a module is defined once at import time while the interface language
 * can change afterwards.
 */
export const coreClientModule = defineClientModule({
  id: 'core',
  name: 'Workspace',
  icon: 'house',

  widgets: [
    {
      id: 'core.waiting-on-you',
      get title() {
        return m.widget_waiting_title()
      },
      get description() {
        return m.widget_waiting_desc()
      },
      icon: 'bell',
      sizes: ['m', 'l', 'xl'],
      defaultSize: 'l',
      order: 10,
      settings: [
        {
          kind: 'number',
          key: 'limit',
          get label() {
            return m.widget_setting_rows()
          },
          default: 6,
          min: 3,
          max: 12,
        },
      ],
      component: () => import('./widgets/WaitingWidget.svelte'),
    },
    {
      id: 'core.stat-unread',
      get title() {
        return m.widget_unread_title()
      },
      get description() {
        return m.widget_unread_desc()
      },
      icon: 'inbox',
      sizes: ['s'],
      defaultSize: 's',
      compact: true,
      order: 20,
      component: () => import('./widgets/UnreadWidget.svelte'),
    },
    {
      id: 'core.stat-mentions',
      get title() {
        return m.widget_mentions_title()
      },
      get description() {
        return m.widget_mentions_desc()
      },
      icon: 'at-sign',
      sizes: ['s'],
      defaultSize: 's',
      compact: true,
      order: 30,
      component: () => import('./widgets/MentionsWidget.svelte'),
    },
    {
      id: 'core.stat-workspaces',
      get title() {
        return m.widget_workspaces_title()
      },
      get description() {
        return m.widget_workspaces_desc()
      },
      icon: 'building',
      sizes: ['s'],
      defaultSize: 's',
      compact: true,
      order: 40,
      component: () => import('./widgets/WorkspacesWidget.svelte'),
    },
    {
      id: 'core.people',
      get title() {
        return m.widget_people_title()
      },
      get description() {
        return m.widget_people_desc()
      },
      icon: 'users',
      permission: 'core.members.view',
      sizes: ['m', 'l'],
      defaultSize: 'm',
      order: 50,
      settings: [
        {
          kind: 'number',
          key: 'limit',
          get label() {
            return m.widget_setting_rows()
          },
          default: 8,
          min: 3,
          max: 20,
        },
      ],
      component: () => import('./widgets/PeopleWidget.svelte'),
    },
    {
      id: 'core.activity',
      get title() {
        return m.widget_activity_title()
      },
      get description() {
        return m.widget_activity_desc()
      },
      icon: 'scroll-text',
      // The audit log is admin-only, so this widget is absent from the picker for everyone else
      // rather than placed and then refused.
      permission: 'core.audit.view',
      sizes: ['m', 'l', 'xl'],
      defaultSize: 'l',
      order: 60,
      settings: [
        {
          kind: 'number',
          key: 'limit',
          get label() {
            return m.widget_setting_rows()
          },
          default: 8,
          min: 3,
          max: 20,
        },
      ],
      component: () => import('./widgets/ActivityWidget.svelte'),
    },
  ],
})

export default coreClientModule
