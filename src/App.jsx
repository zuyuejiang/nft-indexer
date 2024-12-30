import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Image,
  Input,
  SimpleGrid,
  Text,
  Spinner
} from '@chakra-ui/react';
import { Alchemy, Network } from 'alchemy-sdk';
import { useState } from 'react';
import { ethers } from 'ethers';

const DEFAULT_IMAGE_URL = 'favicon.png'; // Default image for NFTs without images

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function App() {
  const [userAddress, setUserAddress] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [results, setResults] = useState({ ownedNfts: [] });
  const [hasQueried, setHasQueried] = useState(false);
  const [tokenDataObjects, setTokenDataObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function resolveENSorAddress(input) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        'https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID' // Replace with your Infura or Alchemy endpoint
      );

      // Check if input is an ENS domain (ends with .eth)
      if (input.toLowerCase().endsWith('.eth')) {
        const address = await provider.resolveName(input);
        if (!address) throw new Error('Unable to resolve ENS domain.');
        return address;
      }

      // Otherwise, assume it's an Ethereum address
      if (ethers.utils.isAddress(input)) {
        return input;
      } else {
        throw new Error('Invalid Ethereum address or ENS domain.');
      }
    } catch (err) {
      throw new Error('Error resolving ENS or address: ' + err.message);
    }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install it to use this feature.');
      }
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setUserAddress(address);
      setResolvedAddress(address);
    } catch (err) {
      setError(err.message || 'An error occurred while connecting the wallet.');
    }
  }

  async function getNFTsForOwner() {
    setLoading(true);
    setError(''); // Clear previous errors
    setResults({ ownedNfts: [] }); // Clear previous results
    setTokenDataObjects([]); // Clear previous token data objects

    try {
      const resolved = await resolveENSorAddress(userAddress);
      setResolvedAddress(resolved);

      const config = {
        apiKey: 'Xq23Kn_d8n4PLXmBVePyb1cc4-H6J-yX',
        network: Network.ETH_MAINNET,
      };

      const alchemy = new Alchemy(config);
      const data = await alchemy.nft.getNftsForOwner(resolved);
      setResults(data);

      const tokenDataPromises = [];

      for (let i = 0; i < data.ownedNfts.length; i++) {
        const tokenData = async () => {
          await delay(200); // Delay each API call by 200ms to avoid rate limits
          return alchemy.nft.getNftMetadata(
            data.ownedNfts[i]?.contract?.address,
            data.ownedNfts[i]?.tokenId
          );
        };
        tokenDataPromises.push(tokenData());
      }

      setTokenDataObjects(await Promise.all(tokenDataPromises));
      setHasQueried(true);
    } catch (err) {
      setError('Error fetching NFTs: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  function exportData(format) {
    if (!hasQueried || results.ownedNfts.length === 0) {
      setError('No data to export. Please make a query first.');
      return;
    }

    const exportData = results.ownedNfts.map((e, i) => ({
      name: tokenDataObjects[i]?.title || 'No Name',
      contractAddress: e.contract?.address,
      tokenId: e.tokenId,
      image: tokenDataObjects[i]?.rawMetadata?.image || DEFAULT_IMAGE_URL,
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'nfts.json';
      link.click();
    } else if (format === 'csv') {
      const csvContent = [
        'Name,Contract Address,Token ID,Image',
        ...exportData.map(row => `${row.name},${row.contractAddress},${row.tokenId},${row.image}`),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'nfts.csv';
      link.click();
    }
  }

  return (
    <Box w="100vw">
      <Center>
        <Flex
          alignItems={'center'}
          justifyContent="center"
          flexDirection={'column'}
        >
          <Heading mb={0} fontSize={36}>
            NFT Indexer 🖼
          </Heading>
          <Text>
            Plug in an address or ENS domain, <span style={{ color: 'teal', cursor: 'pointer' }} onClick={connectWallet}>🔮 Connect Wallet</span>, and this website will return all of its NFTs!
          </Text>
        </Flex>
      </Center>
      <Flex
        w="100%"
        flexDirection="column"
        alignItems="center"
        justifyContent={'center'}
      >
        <Flex alignItems="center" mt={4}>
          <Input
            onChange={(e) => setUserAddress(e.target.value)}
            color="black"
            w="600px"
            textAlign="center"
            p={4}
            bgColor="white"
            fontSize={24}
            placeholder="Enter Ethereum address or ENS domain"
          />
          <Button fontSize={20} onClick={getNFTsForOwner} ml={4} bgColor="#b5b3c8">
            Fetch NFTs
          </Button>
        </Flex>
        {resolvedAddress && (
          <Text mt={4} color="green.500">
            Resolved Address: {resolvedAddress}
          </Text>
        )}
        <Flex mt={4} justifyContent="center">
          <Button fontSize={20} onClick={() => exportData('json')} mx={2} bgColor="transparent">
            Export as JSON
          </Button>
          <Button fontSize={20} onClick={() => exportData('csv')} mx={2} bgColor="transparent">
            Export as CSV
          </Button>
        </Flex>

        {loading && (
          <Flex mt={4} alignItems="center" justifyContent="center">
            <Spinner size="lg" color="blue.500" />
            <Text ml={4}>Loading...</Text>
          </Flex>
        )}

        {error && (
          <Text mt={4} color="red.500">
            {error}
          </Text>
        )}


        <Heading my={36}>Here are your NFTs:</Heading>

        {hasQueried && !loading ? (
          <SimpleGrid w={'90vw'} columns={5} spacing={8}>
            {results.ownedNfts.map((e, i) => {
              return (
                <Flex
                  flexDir={'column'}
                  color="black"
                  bg="gray.800"
                  borderRadius="md"
                  boxShadow="lg"
                  p={4}
                  w={'100%'}
                  key={`${e.contract?.address}-${e.tokenId}`}
                  alignItems="center"
                  justifyContent="space-between"
                  textAlign="center"
                  _hover={{ transform: 'scale(1.05)', transition: '0.3s' }}
                >
                  <Box mb={4}>
                    <b>Token:</b>{' '}
                    {tokenDataObjects[i]?.title?.length > 0
                      ? tokenDataObjects[i].title
                      : 'No Name'}
                  </Box>
                  <Image
                    src={
                      tokenDataObjects[i]?.rawMetadata?.image ?? DEFAULT_IMAGE_URL
                    }
                    onError={(e) => {
                      e.target.src = DEFAULT_IMAGE_URL; // Replace broken images with default
                    }}
                    alt={'NFT Image'}
                    boxSize="150px"
                    borderRadius="md"
                    objectFit="cover"
                  />
                </Flex>
              );
            })}
          </SimpleGrid>
        ) : (
          !loading && 'Please make a query! The query may take a few seconds...'
        )}
      </Flex>
    </Box>
  );
}

export default App;
