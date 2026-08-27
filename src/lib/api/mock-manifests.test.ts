import { hrCapabilities } from '@kernhq/module-hr/contract'
import {
  InventorySettings,
  inventoryCapabilities,
  inventoryEvents,
  inventoryPermissions,
} from '@kernhq/module-inventory/contract'
import { describe, expect, it } from 'vitest'
import { manifestOf, moduleManifests } from './mock'

/**
 * Holds `dev:mock`'s module manifests to what the modules themselves declare.
 *
 * Settings → Modules and the admin screens read these, and `dev:mock` is the environment the
 * product is demonstrated in — so a number typed here by hand is a number a customer is shown. They
 * drift silently and they did: inventory's entry said two permissions, three events, no object type
 * and no settings pages, written when the module had five procedures, and it kept saying so through
 * three phases of work that took it to twenty-three procedures, five permissions, seven events and
 * two settings pages.
 *
 * The capability lists are the same defect with a worse symptom, because the shell *acts* on them:
 * a module absent from `MODULE_CAPABILITIES` resolves to no capabilities at all, and every screen
 * gated on one is filtered out of the demo and out of the UX sweep. Inventory shipped Repairs and
 * Files that way — built, tested, and invisible in the only environment anybody looks at.
 *
 * A count that cannot be read off a contract is asserted here as a literal with the reason why,
 * which at least moves the hand-written number to a file whose job is to fail.
 */

const manifest = (id: string) => {
  const seed = moduleManifests.find((m) => m.id === id)
  if (!seed) throw new Error(`no mock manifest for ${id}`)
  return manifestOf(seed)
}

describe('the mock module manifests', () => {
  it('gives every module a unique id', () => {
    // `hr` was in here twice and every list keyed by module id threw `each_key_duplicate`, which
    // stops Svelte mid-paint: four admin screens sat on their skeletons for ever, with nothing
    // failing a build, a type-check or a feature test.
    const ids = moduleManifests.map((m) => m.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  describe('inventory', () => {
    it('offers the capabilities the module declares', () => {
      expect(manifest('inventory').capabilities.map((c) => c.id)).toEqual(
        inventoryCapabilities.map((c) => c.id),
      )
    })

    it('resolves to all three capabilities in a workspace that has never switched one', () => {
      // `core` is required and the other two are `defaultEnabled`, so the asset panel shows five
      // tabs rather than three. This is the assertion that fails if the module goes missing from
      // `MODULE_CAPABILITIES` again: an empty list is what the demo had.
      const defaults = manifest('inventory')
        .capabilities.filter((c) => c.required || c.defaultEnabled)
        .map((c) => c.id)
      expect(defaults).toEqual(['core', 'repairs', 'attachments'])
    })

    it('reports the permissions the module declares', () => {
      expect(manifest('inventory').permissions).toHaveLength(inventoryPermissions.length)
    })

    it('reports the events the module declares', () => {
      expect(manifest('inventory').events).toHaveLength(Object.keys(inventoryEvents).length)
    })

    it('reports that the module has settings', () => {
      expect(Object.keys(InventorySettings.shape).length).toBeGreaterThan(0)
      expect(manifest('inventory').settingsSchema).toBeDefined()
    })

    it('reports the one object type the module declares', () => {
      // `inventory:asset:<id>` is declared on the *server* manifest, which this test cannot import
      // — it is Node-only. So the number is written twice on purpose, and this is the copy that
      // fails loudly rather than the copy a customer reads.
      expect(manifest('inventory').objectTypes).toHaveLength(1)
    })
  })

  describe('hr', () => {
    it('offers the capabilities the module declares', () => {
      expect(manifest('hr').capabilities.map((c) => c.id)).toEqual(hrCapabilities.map((c) => c.id))
    })
  })
})
