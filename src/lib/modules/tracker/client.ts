import { defineClientModule } from '@kernhq/ui'
import * as m from '$msg'
import { TRACKER_PERMISSIONS } from './permissions'

/**
 * The tracker as the shell sees it.
 *
 * A module does not reach into the application: it declares what it contributes — navigation, pages,
 * command-palette actions, keyboard shortcuts and how its objects are drawn elsewhere — and the shell
 * composes that with whatever else is enabled for the workspace. Turning the tracker off in workspace
 * settings removes all of it without a single conditional anywhere in the shell.
 *
 * Labels are getters rather than strings because a module is defined once at import time while the
 * interface language can change afterwards; reading them on render keeps the rail and the palette in
 * the language the person actually chose.
 */
export const trackerClientModule = defineClientModule({
  id: 'tracker',
  name: 'Issues',
  icon: 'square-check-big',

  nav: [
    {
      id: 'tracker',
      get label() {
        return m.tracker_nav()
      },
      icon: 'square-check-big',
      href: '/tracker',
      order: 20,
      permission: TRACKER_PERMISSIONS.view,
    },
  ],

  routes: [
    {
      path: '/tracker',
      component: () => import('./IssuesPage.svelte'),
      get title() {
        return m.tracker_title()
      },
      permission: TRACKER_PERMISSIONS.view,
    },
  ],

  commands: [
    {
      id: 'tracker.new-issue',
      get label() {
        return m.tracker_new_issue()
      },
      icon: 'plus',
      shortcut: ['c'],
      permission: TRACKER_PERMISSIONS.create,
      run: (ctx) => ctx.navigate('/tracker?new=1'),
    },
    {
      id: 'tracker.issues',
      get label() {
        return m.tracker_cmd_open_list()
      },
      icon: 'list',
      permission: TRACKER_PERMISSIONS.view,
      run: (ctx) => ctx.navigate('/tracker'),
    },
    {
      id: 'tracker.board',
      get label() {
        return m.tracker_cmd_open_board()
      },
      icon: 'columns-3',
      permission: TRACKER_PERMISSIONS.view,
      run: (ctx) => ctx.navigate('/tracker?view=board'),
    },
    {
      id: 'tracker.my-issues',
      get label() {
        return m.tracker_cmd_my_issues()
      },
      icon: 'user',
      permission: TRACKER_PERMISSIONS.view,
      run: (ctx) => ctx.navigate('/tracker?preset=assigned'),
    },
    {
      id: 'tracker.triage',
      get label() {
        return m.tracker_cmd_triage()
      },
      icon: 'inbox',
      permission: TRACKER_PERMISSIONS.view,
      run: (ctx) => ctx.navigate('/tracker?q=triage%20%3D%20true'),
    },
    {
      id: 'tracker.by-project',
      get label() {
        return m.tracker_cmd_by_project()
      },
      icon: 'diamond',
      permission: TRACKER_PERMISSIONS.view,
      run: (ctx) => ctx.navigate('/tracker?group=project'),
    },
  ],

  shortcuts: [
    {
      id: 'tracker.new-issue',
      keys: ['c'],
      get label() {
        return m.tracker_new_issue()
      },
      scope: 'tracker',
      run: (ctx) => ctx.navigate('/tracker?new=1'),
    },
  ],

  presenters: [
    {
      type: 'issue',
      inline: () => import('./components/IssueInline.svelte'),
      page: (id, workspaceSlug) => `/${workspaceSlug}/tracker?issue=${encodeURIComponent(id)}`,
    },
  ],
})

export default trackerClientModule
