/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  main, container, headerBar, wordmark, card, h1, text, button, footer, footerBar,
} from './_styles.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Heading as="h1" style={wordmark}>Lumi ✨</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Your magic login link</Heading>
          <Text style={text}>
            Tap the button below to sign in to {siteName}. This link expires shortly,
            so don't keep it waiting too long 💜
          </Text>
          <Button style={button} href={confirmationUrl}>
            Log me in →
          </Button>
          <Text style={footer}>
            Didn't request this link? You can safely ignore this email.
          </Text>
        </Section>
        <Section style={footerBar}>
          Lumi · Meta Ads, Simplified
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
