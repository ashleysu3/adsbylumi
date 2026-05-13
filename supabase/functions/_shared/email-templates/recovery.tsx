/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

import {
  main, container, headerBar, wordmark, card, h1, text, button, footer, footerBar,
} from './_styles.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Heading as="h1" style={wordmark}>Lumi ✨</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            We got a request to reset your password for {siteName}. Tap the button
            below to choose a new one.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Reset my password →
          </Button>
          <Text style={footer}>
            Didn't request a reset? You can safely ignore this email — your password
            won't change.
          </Text>
        </Section>
        <Section style={footerBar}>
          Lumi · Meta Ads, Simplified
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
