// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../../contracts/TTNVestingManager.sol";

contract DeployTGE is Script {
    address constant VESTING_PROXY = 0x2Df41d6e79A76bD4E913ab6dC8B954581Ee8E67f;
    
    function run() external {
        VestingManager vesting = VestingManager(VESTING_PROXY);
        uint256 unlockTime = block.timestamp - (block.timestamp % 86400) + 86400 + (12 * 3600);
        
        console.log("Deploying", 74, "vesting schedules");
        console.log("Unlock time:", unlockTime);
        
        vm.startBroadcast();
        
        vesting.createVestingSchedule(0x72C1dE2D2e0E4C406026C3D55b8C9E4E05da3960, 10333250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x5696EE184E8FEB538B1D98203B0f21924c658C3B, 9666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x07b90441C99dbF3bc41725563704E6F57C7044dc, 5833250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x01766ba52220bf2B899Ec127b0051c935b99f49F, 10583250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x0d72A7AD2bA11ac7A950A276B4D6cD30DF56FEEe, 22666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x57143Bb2c201B43bD26B4Be705a4f09f295421e1, 19333250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x85ed89CF529d549FDcb60d9e72078E4f18aa30F3, 4833250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xCACEeBfD2E88ce3741dd45622cDf5D2f3166e8f5, 20833250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xfcA85f35f489ebAbA486FD12A8B0CAafF600BB04, 4166750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x31CA1b9f7d00E7cAd4579652062c2C4b551e0A29, 13500000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xC445b517f51F37878280C37C44664F1EB3Ca8810, 15000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xe1A6E50E56867b22d5A30cF9c5d83E96EE43F7f3, 4666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xC7cf4ab65593e0dE5B68799Ee04EABC5789bf89E, 4750000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x4E0965fec81519BEc6882D1EB8D4f022cc0B3A31, 6000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xbD41a5F656116F23Eca55F40AAdAA2Dada35ccC1, 5000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x9c0e8a6fd245be8f7b21F1F3B20686c6F8F2cB54, 3833250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x5a6825c47722802849FBB62560D55eE0ad7CBB13, 1666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x5472C1b13AdAC595dACE23f7D4796A25b324a0DE, 3166750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x41FA23a83a042Aba768CBe582c86fE809CAB8607, 8666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x60b19e00d5a7Bc94DC0E990A82d0E4dBdBC7E5Da, 333250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x645b9cD14E1dFE92C5Fce3BeD80bB3Ad44230854, 2000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x2659517be1db8Fc06Da72d12dF1FEb6837c47836, 1750000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x7C48A53e7745e1d84F4a1212Ab1F33268f91A919, 5250000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xfDEBf898843f8AfAc056Ec47f606468918Efd6bf, 2500000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x620759fFf9b857249b9ef45bf42F410128edD75f, 2000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x0A767Bde436d9DdA8A5948966459a69723e087Ff, 1000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x84B9767e4B7aa603535E242012D62Dde9f165da4, 3666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xA3a9ef6829487b75B2AdcD019B5Aa22D7C4d8d1A, 2500000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x6a42Fa80F13754334A1EA663c9873bf0D086AE5B, 1333250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x2410D5391Bb130d24B71680B613d30c489638BCF, 3666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x4f2b41c26D715d54a28bE91154067b050237D233, 10000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x6D3C7da0BDB8028a1bdE4Ee98F654005A74dE189, 250000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xA16e842c4a12C82c8Cb4d801C22e72fB5E03DF63, 833250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x0d128b94E62A7e508CEb72892CFffdb8dC3CF970, 1666750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x20d2b019aaDa101631F619536084B72fA9B26066, 1166750000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xD5c2F697F1d04734E0F98A423fCA2d20A16dc273, 2000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xCf9f5A17158aA014fDa69c1A8e40747a9881Af75, 1833250000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x6De45dFcF9D5B698BcD2f86B4c90F95312EC9a4F, 5000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x77d932251A227fb2A48aC30Fac953E282D648697, 1750000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x37C84d619787A953366e2d637f44a7dE56523346, 25000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x5463CB72e45b1A2f3fA73c4BB57c40074776432C, 20000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xE12099d75E017d39646b832407eff456C763Df99, 16000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x99EDE7FeC7CA75B461Dc4F3693B06054E3a95aE0, 12000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x644d7F66445c3ba14026327051F85c44f97E7BfA, 13333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x63baa869E7C15aFb918d78e0A8dAba6561769D5B, 16000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xf87ea758eC54b00cDA7C54b7a6ef2D032F166554, 6666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xf52a30397151C77E732fA5DeFB9347359C52A141, 13333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x6F1D32c9f0CE39e995370C7d3dfE1AC897fDAAc2, 23333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xd52F264D5400f5B0035258f3D195bF61189BeD4c, 23333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x0869ddDD3a8974807E262379011cc31C4712C587, 17333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xe50AFD71667d874Eba67321F00d115936A605E4D, 6666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x1C81fB7100276Aef766092E16CFcF61097E97A5D, 5333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x00a2F49eF88b5BA48a095421070db3219661baA3, 8000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x8EAe2550B728D4141e94ea2087F5954e7C1F519F, 8000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xAc027974A173A9Cb07D93Cf92F386f808B787885, 10666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xd33BCbD6920aeF002A486BDd4e3d943cb5920461, 11666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x32Bf8145749949Ee6E59bad2BE9515D5C1EF20fa, 11333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xa7683256Acfda979Cb550DdC88F439085E5B3D82, 13333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xC1e22B04CA074F171F711BD781A2803bc2131A6D, 8000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x306EF7276c40a8Aa8c51349665C69C1f4CeFd01D, 9333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x5f721EC76b4690C1B07B7E909C7231F7e1c9F6aA, 6666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xAF07eC56dBd8c5c657c18a0b91B7AbAAc753554e, 6666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xB835d66405CcA31F8782260Ee65b2EBD8F1032A1, 2333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x91756819Ca22B93F8AE089DB06D51cD4fBa3F7A5, 9600000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x9317F23CD516257655447EdaABCb278349194546, 5333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x11CE7e9558F2006D1C7564882500ABfa9dc1288c, 4000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x2E2bD365b570a039aAE3f8aCE7483E711294d2db, 12000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xb6fbE3B43bDe495b6bad07F3e90E0FeD3A72FF6F, 14666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x9f4860e2E8c2F2fab0A84Eb87447C32F5e4Ba230, 5333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x61049b3c02E78f8790b639E22AC3DC111899b8Cb, 12000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x57aa1b0418e8d91e04B56b7c49507e354caF375D, 26666670000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x73141a02d47cb044BF424a7f22f8b7cDfA0Eb0f4, 5333330000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0x507d27994C565d8d8237fBD41950C05158e13D10, 4000000000000000000000, unlockTime, 0, 1, 0);
        vesting.createVestingSchedule(0xE0bB0e0ce8AEFdD0865076E8A535d91f278ed40C, 100000000000000000000000, unlockTime, 0, 1, 0);
        vm.stopBroadcast();
        console.log("Complete! Created", 74, "schedules");
    }
}
