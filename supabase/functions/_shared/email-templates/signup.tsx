/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Img,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  main,
  container,
  headerBar,
  LOGO_URL, logoImg,
  card,
  h1,
  text,
  link,
  button,
  footer,
  footerBar,
} from './_styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to start using Lumi ✨</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Heading as="h1" style={wordmark}>Lumi ✨</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm your email</Heading>
          <Text style={text}>
            Hey 👋 — thanks for signing up for{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
            Tap the button below to confirm{' '}
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
            and we'll get you into your dashboard.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirm my email →
          </Button>
          <Text style={footer}>
            If you didn't create a Lumi account, you can safely ignore this email.
          </Text>
        </Section>
        <Section style={footerBar}>
          Lumi · Meta Ads, Simplified
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
