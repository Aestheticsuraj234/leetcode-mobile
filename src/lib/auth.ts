import { supabase } from '@/lib/supabase'
import type { Provider, Session } from '@supabase/supabase-js'
import { makeRedirectUri } from 'expo-auth-session'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import * as WebBrowser from 'expo-web-browser'


WebBrowser.maybeCompleteAuthSession();

const codeExchanges = new Map<string, Promise<Session | undefined>>();

export function getAuthRedirectUri() {
    return makeRedirectUri({ path: 'auth/callback' })
}

export function isAuthCallbackUrl(url: string) {
    const { params } = QueryParams.getQueryParams(url);
    return !!(params.code || (params.access_token && params.refresh_token))
}

export async function createSessionFromUrl(url: string) {
    const { params, errorCode } = QueryParams.getQueryParams(url)
    if (errorCode) throw new Error(errorCode)

    if (params.code) {
        const existing = codeExchanges.get(params.code)
        if (existing) return existing

        const exchange = (async () => {
            const { data, error } = await supabase.auth.exchangeCodeForSession(params.code)
            if (error) {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) return session
                throw error
            }
            return data.session
        })()

        codeExchanges.set(params.code, exchange)

        try {
            return await exchange
        } finally {
            codeExchanges.delete(params.code)
        }
    }

    if (params.access_token && params.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
        })
        if (error) throw error
        return data.session
    }
}

function getRedirectSetupMessage(redirectUri: string) {
    return [
        'Supabase rejected the app redirect URL and sent you to localhost instead.',
        '',
        'Open Supabase Dashboard → Authentication → URL Configuration and add:',
        `  ${redirectUri}`,
        '  exp://**',
        '  leetcodemobile://**',
        '',
        'Then try signing in again.',
    ].join('\n')
}

export async function SignInWithOAuth(provider: Provider) {
    const redirectTo = getAuthRedirectUri();

    console.log('redirectTo', redirectTo);

    if (!redirectTo) {
        throw new Error('Could not determine OAuth redirect URI for this platform.')
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo,
            skipBrowserRedirect: true
        }
    });

    console.log('data', data);
    console.log('error', error);

    if (error) throw error
    if (!data.url) throw new Error('No OAuth URL returned')

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
        showInRecents: true
    });

    console.log('result', result);

    if (result.type === 'success') {
        return createSessionFromUrl(result.url)
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
        return
    }

    console.log('getRedirectSetupMessage', getRedirectSetupMessage(redirectTo));
    throw new Error(getRedirectSetupMessage(redirectTo))
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}
