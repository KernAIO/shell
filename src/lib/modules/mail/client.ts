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
