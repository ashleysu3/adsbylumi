/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

import {
  main, container, headerBar, LOGO_URL, logoImg, card, h1, text, link, button, footer, footerBar,
} from './_styles.ts'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Img src={LOGO_URL} alt="Lumi" style={logoImg} width="140" />
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm your email change</Heading>
          <Text style={text}>
            You requested to change the email on your {siteName} account from{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> to{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Text style={text}>Tap the button below to confirm the change:</Text>
          <Button style={button} href={confirmationUrl}>
            Confirm email change →
          </Button>
          <Text style={footer}>
            If you didn't request this change, please secure your account immediately.
          </Text>
        </Section>
        <Section style={footerBar}>
          Lumi · Meta Ads, Simplified
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
