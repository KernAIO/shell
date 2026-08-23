import { BILLING_PERMISSIONS } from '@kernhq/module-billing/client'
import { defineClientModule } from '@kernhq/ui'
import * as m from '$msg'

/**
 * Billing as the shell sees it.
 *
 * No navigation: what a workspace pays is not somewhere people go, it is somewhere an owner goes
 * once a month. One workspace settings page for the customer, and two instance pages for whoever
 * runs the instance — which on a self-hosted Kern is the same person, and on Kern Cloud is us.
 *
 * Labels are getters because a module is defined once at import time while the interface language
 * can change afterwards; reading them on render keeps the nav in the language actually chosen.
 */
export const billingClientModule = defineClientModule({
  id: 'billing',
  name: 'Billing',
  icon: 'credit-card',

  settingsPages: [
    {
      id: 'plan',
      get label() {
        return m.billing_settings_nav()
      },
      icon: 'credit-card',
      scope: 'workspace',
      permission: BILLING_PERMISSIONS.view,
      order: 60,
      component: () => import('../../../routes/(app)/[ws]/settings/billing/plan/+page.svelte'),
    },
    {
      id: 'subscriptions',
      get label() {
        return m.billing_admin_subscriptions_nav()
      },
      icon: 'credit-card',
      scope: 'instance',
      order: 20,
      component: () => import('../../../routes/(app)/[ws]/admin/billing/subscriptions/+page.svelte'),
    },
    {
      id: 'plans',
      get label() {
        return m.billing_admin_plans_nav()
      },
      icon: 'tag',
      scope: 'instance',
      order: 30,
      component: () => import('../../../routes/(app)/[ws]/admin/billing/plans/+page.svelte'),
    },
  ],
})

export default billingClientModule
