import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveAccess, requirePro, isLocked } from '../plan-gate'

const futureISO = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
const pastISO = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

describe('resolveAccess', () => {
  it('returns "trial" while trial_ends_at is in the future', () => {
    expect(
      resolveAccess({
        plan: 'trial',
        trialEndsAt: futureISO(5),
        proExpiresAt: null,
        subscriptionStatus: null,
      }),
    ).toBe('trial')
  })

  it('returns "pro" only when plan=pro AND status=active AND not expired', () => {
    expect(
      resolveAccess({
        plan: 'pro',
        trialEndsAt: null,
        proExpiresAt: futureISO(20),
        subscriptionStatus: 'active',
      }),
    ).toBe('pro')
  })

  it('falls back to free when pro_expires_at is in the past', () => {
    expect(
      resolveAccess({
        plan: 'pro',
        trialEndsAt: null,
        proExpiresAt: pastISO(1),
        subscriptionStatus: 'active',
      }),
    ).toBe('free')
  })

  it('returns free when status is past_due regardless of plan label', () => {
    expect(
      resolveAccess({
        plan: 'pro',
        trialEndsAt: null,
        proExpiresAt: futureISO(20),
        subscriptionStatus: 'past_due',
      }),
    ).toBe('free')
  })

  it('returns free with no subscription and no trial', () => {
    expect(
      resolveAccess({
        plan: 'free',
        trialEndsAt: pastISO(10),
        proExpiresAt: null,
        subscriptionStatus: null,
      }),
    ).toBe('free')
  })
})

describe('requirePro / isLocked', () => {
  const originalFlag = process.env.BILLING_ENFORCEMENT_ENABLED

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.BILLING_ENFORCEMENT_ENABLED
    } else {
      process.env.BILLING_ENFORCEMENT_ENABLED = originalFlag
    }
  })

  describe('with enforcement disabled', () => {
    beforeEach(() => {
      delete process.env.BILLING_ENFORCEMENT_ENABLED
    })

    it('grants access regardless of plan state', () => {
      const r = requirePro({
        plan: 'free',
        trialEndsAt: null,
        proExpiresAt: null,
        subscriptionStatus: null,
      })
      expect(r.ok).toBe(true)
    })

    it('reports nothing as locked', () => {
      expect(
        isLocked({
          plan: 'free',
          trialEndsAt: null,
          proExpiresAt: null,
          subscriptionStatus: null,
        }),
      ).toBe(false)
    })
  })

  describe('with enforcement enabled', () => {
    beforeEach(() => {
      process.env.BILLING_ENFORCEMENT_ENABLED = '1'
    })

    it('lets trial users through', () => {
      const r = requirePro({
        plan: 'trial',
        trialEndsAt: futureISO(3),
        proExpiresAt: null,
        subscriptionStatus: null,
      })
      expect(r.ok).toBe(true)
    })

    it('blocks free users with a clear reason', () => {
      const r = requirePro({
        plan: 'free',
        trialEndsAt: pastISO(1),
        proExpiresAt: null,
        subscriptionStatus: null,
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.reason).toBe('free')
        expect(r.error).toMatch(/Pro/)
      }
    })

    it('flags past_due distinctly from generic free', () => {
      const r = requirePro({
        plan: 'pro',
        trialEndsAt: null,
        proExpiresAt: futureISO(2),
        subscriptionStatus: 'past_due',
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.reason).toBe('past_due')
      }
    })
  })
})
