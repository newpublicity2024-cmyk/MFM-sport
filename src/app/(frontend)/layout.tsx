import React from 'react'
import './styles.css'

export default async function FrontendLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return <main>{children}</main>
}
