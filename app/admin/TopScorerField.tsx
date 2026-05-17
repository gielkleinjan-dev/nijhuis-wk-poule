"use client";

import { useState } from "react";
import PlayerCombobox from "@/app/components/PlayerCombobox";

// Houdt de geselecteerde topscorer-naam lokaal vast en publiceert 'm via een
// hidden input zodat de admin-form server action 'm meekrijgt.
export default function TopScorerField({
  initial,
  name,
}: {
  initial: string;
  name: string;
}) {
  const [val, setVal] = useState(initial);
  return <PlayerCombobox value={val} onChange={setVal} name={name} />;
}
