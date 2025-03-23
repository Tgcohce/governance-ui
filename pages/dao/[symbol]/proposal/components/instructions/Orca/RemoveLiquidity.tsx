import { useContext, useEffect, useState } from 'react'
import * as yup from 'yup'
import {
  ProgramAccount,
  Governance,
  serializeInstructionToBase64,
} from '@solana/spl-governance'
import { validateInstruction } from '@utils/instructionTools'
import { UiInstruction } from '@utils/uiTypes/proposalCreationTypes'
import { PublicKey } from '@solana/web3.js'
import { NewProposalContext } from '../../../new'
import InstructionForm, { InstructionInput } from '../FormCreator'
import { InstructionInputType } from '../inputInstructionType'
import { AssetAccount } from '@utils/uiTypes/assets'
import useWalletOnePointOh from '@hooks/useWalletOnePointOh'
import { useRealmQuery } from '@hooks/queries/realm'
import useGovernanceAssets from '@hooks/useGovernanceAssets'
import {
  setWhirlpoolsConfig,
  decreaseLiquidityInstructions,
} from '@orca-so/whirlpools'

interface RemoveLiquidityForm {
  governedAccount?: AssetAccount
  positionMint: string
  tokenAAmount?: number
  tokenBAmount?: number
  slippageBps?: number
}

export default function RemoveLiquidity({
  index,
  governance,
}: {
  index: number
  governance: ProgramAccount<Governance> | null
}) {
  const { handleSetInstructions } = useContext(NewProposalContext)
  const realm = useRealmQuery().data?.result
  const { assetAccounts } = useGovernanceAssets()
  const wallet = useWalletOnePointOh()

  const [form, setForm] = useState<RemoveLiquidityForm>({
    positionMint: '',
    tokenAAmount: 0,
    tokenBAmount: 0,
    slippageBps: 100,
  })
  const [formErrors, setFormErrors] = useState({})

  const shouldBeGoverned = !!(index !== 0 && governance)

  const schema = yup.object().shape({
    governedAccount: yup.object().nullable().required('Governance account is required'),
    positionMint: yup.string().required('Position mint pubkey is required'),
    slippageBps: yup.number().min(0).max(10000).required('Slippage BPS required'),
  })

  async function getInstruction(): Promise<UiInstruction> {
    const isValid = await validateInstruction({ schema, form, setFormErrors })
    let serializedInstruction = ''

    if (isValid && form.governedAccount?.governance?.account && wallet?.publicKey) {
      await setWhirlpoolsConfig('solanaDevnet')

      // Decrease partial liquidity from an existing position
      const param: Record<string, bigint> = {}
      if (form.tokenAAmount) {
        param.tokenA = BigInt(form.tokenAAmount)
      }
      if (form.tokenBAmount) {
        param.tokenB = BigInt(form.tokenBAmount)
      }

      const { instructions } = await decreaseLiquidityInstructions(
        undefined, // devnetRpc or your custom RPC
        new PublicKey(form.positionMint),
        param,
        form.slippageBps,
        wallet
      )

      if (instructions.length > 0) {
        serializedInstruction = serializeInstructionToBase64(instructions[0])
      }
    }

    return {
      serializedInstruction,
      isValid,
      governance: form?.governedAccount?.governance,
    }
  }

  const inputs: InstructionInput[] = [
    {
      label: 'Governance',
      initialValue: null,
      name: 'governedAccount',
      type: InstructionInputType.GOVERNED_ACCOUNT,
      shouldBeGoverned,
      governance,
      options: assetAccounts,
    },
    {
      label: 'Position Mint',
      initialValue: '',
      name: 'positionMint',
      type: InstructionInputType.INPUT,
      inputType: 'text',
    },
    {
      label: 'Token A Amount to remove (optional)',
      initialValue: 0,
      name: 'tokenAAmount',
      type: InstructionInputType.INPUT,
      inputType: 'number',
    },
    {
      label: 'Token B Amount to remove (optional)',
      initialValue: 0,
      name: 'tokenBAmount',
      type: InstructionInputType.INPUT,
      inputType: 'number',
    },
    {
      label: 'Slippage BPS',
      initialValue: 100,
      name: 'slippageBps',
      type: InstructionInputType.INPUT,
      inputType: 'number',
    },
  ]

  useEffect(() => {
    handleSetInstructions(
      { governedAccount: form?.governedAccount?.governance, getInstruction },
      index
    )
  }, [form])

  return (
    <InstructionForm
      outerForm={form}
      setForm={setForm}
      inputs={inputs}
      setFormErrors={setFormErrors}
      formErrors={formErrors}
    />
  )
}
