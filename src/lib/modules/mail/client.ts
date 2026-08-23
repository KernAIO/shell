import { defineClientModule } from '@kernhq/ui'
import * as m from '$msg'
import { MAIL_PERMISSIONS } from './permissions'

/**
 * Mail as the shell sees it.
 *
 * No navigation: where a workspace's email comes from is configuration, not a place people visit.
 * The module contributes one settings page, and turning mail off in workspace settings removes it
 * with no conditionals anywhere in the shell.
 *
 * Labels are getters because a module is defined once at import time while the interface language
 * can change afterwards; reading them on render keeps the nav in the language actually chosen.
 */
export const mailClientModule = defineClientModule({
  id: 'mail',
  name: 'Mail',
  icon: 'mail',

  widgets: [
    {
      id: 'mail.deliveries',
      get title() {
        return m.widget_mail_title()
      },
      get description() {
        return m.widget_mail_desc()
      },
      icon: 'mail',
      permission: MAIL_PERMISSIONS.deliveriesView,
      sizes: ['m', 'l', 'xl'],
      defaultSize: 'l',
      order: 10,
      settings: [
        {
          kind: 'select',
          key: 'status',
          get label() {
            return m.widget_setting_status()
          },
          default: null,
          nullable: true,
          get nullLabel() {
            return m.dash_any()
          },
          get options() {
            return [
              { value: 'queued', label: m.widget_mail_queued() },
              { value: 'sent', label: m.widget_mail_sent() },
              { value: 'failed', label: m.widget_mail_failed() },
              { value: 'bounced', label: m.widget_mail_bounced() },
            ]
          },
        },
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
      component: () => import('./widgets/DeliveriesWidget.svelte'),
    },
    {
      id: 'mail.stat-failed',
      get title() {
        return m.widget_mail_failed_title()
      },
      get description() {
        return m.widget_mail_failed_desc()
      },
      icon: 'circle-alert',
      permission: MAIL_PERMISSIONS.deliveriesView,
      sizes: ['s'],
      defaultSize: 's',
      compact: true,
      order: 20,
      component: () => import('./widgets/FailedWidget.svelte'),
    },
  ],

  settingsPages: [
    {
      id: 'mail',
      get label() {
        return m.mail_settings_nav()
      },
      icon: 'mail',
      scope: 'workspace',
      permission: MAIL_PERMISSIONS.settingsManage,
      order: 45,
      component: () => import('../../../routes/(app)/[ws]/settings/mail/+page.svelte'),
    },
  ],
})

export default mailClientModule
