pragma solidity ^0.4.24;

import "./rcn/utils/BytesUtils.sol";
import "./rcn/utils/RpSafeMath.sol";
import "./rcn/utils/Ownable.sol";
import "./ERC721Base.sol";

interface ERC721 {
    function transferFrom(address from, address to, uint256 id) external;
    function ownerOf(uint256 id) external view returns (address);
}

contract Bundle is ERC721Base, BytesUtils, RpSafeMath {
    Bundle[] private bundles;

    event Deposit(address sender, uint256 bundle, address token, uint256 id);
    event Withdraw(address retriever, uint256 bundle, address token, uint256 id);

    struct Bundle {
        address[] tokens;
        uint256[] ids;
        mapping(address => mapping(uint256 => uint256)) order;
    }

    constructor() public {
        bundles.length++;
    }

    modifier canWithdraw(uint256 bundleId) {
        require(_isAuthorized(msg.sender, bundleId), "Not authorized for withdraw");
        _;
    }

    function canDeposit(uint256 bundleId) public view returns (bool) {
        return _isAuthorized(msg.sender, bundleId);
    }

    function content(uint256 id) external view returns (address[] tokens, uint256[] ids) {
        Bundle memory bundle = bundles[id];
        tokens = bundle.tokens;
        ids = bundle.ids;
    }

    // create bundle
    /**
    @notice Create a empty Bundle in bundles array
    */
    function create() public returns (uint256 id) {
        id = bundles.length;
        bundles.length++;
        _generate(id, msg.sender);
    }

    function deposit(
        uint256 _bundleId,
        ERC721 token,
        uint256 tokenId
    ) external returns (bool) {
        uint256 bundleId = _bundleId == 0 ? create() : _bundleId;
        require(canDeposit(bundleId), "Not authorized for deposit");
        return _deposit(bundleId, token, tokenId);
    }

    function depositBatch(
        uint256 _bundleId,
        ERC721[] tokens,
        uint256[] ids
    ) external returns (bool) {
        uint256 bundleId = _bundleId == 0 ? create() : _bundleId;
        require(canDeposit(bundleId), "Not authorized for deposit");

        require(tokens.length == ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            require(_deposit(bundleId, tokens[i], ids[i]));
        }

        return true;
    }

    function _deposit(
        uint256 bundleId,
        ERC721 token,
        uint256 tokenId
    ) internal returns (bool) {
        token.transferFrom(msg.sender, address(this), tokenId);
        require(token.ownerOf(tokenId) == address(this), "ERC721 transfer failed");

        Bundle storage bundle = bundles[bundleId];
        _add(bundle, token, tokenId);

        emit Deposit(msg.sender, bundleId, token, tokenId);

        return true;
    }

    function withdraw(
        uint256 bundleId,
        ERC721 token,
        uint256 tokenId,
        address to
    ) public canWithdraw(bundleId) {
        Bundle storage bundle = bundles[bundleId];
        _remove(bundle, token, tokenId);

        emit Withdraw(msg.sender, bundleId, token, tokenId);

        token.transferFrom(this, to, tokenId);
        require(token.ownerOf(tokenId) == to, "ERC721 transfer failed");
    }

    function _add(
        Bundle storage bundle,
        ERC721 token,
        uint256 id
    ) internal {
        uint256 position = bundle.order[token][id];
        require(!_isAsset(bundle, position, token, id), "Already exist");
        position = bundle.tokens.length;
        bundle.tokens.push(token);
        bundle.ids.push(id);
        bundle.order[token][id] = position;
    }

    function _remove(
        Bundle storage bundle,
        ERC721 token,
        uint256 id
    ) internal {
        uint256 delPosition = bundle.order[token][id];
        require(_isAsset(bundle, delPosition, token, id), "The token does not exist inside the bundle");

        // Replace item to remove with last item
        // (make the item to remove the last one)
        uint256 lastPosition = bundle.tokens.length - 1;
        if (lastPosition != delPosition) {
            address lastToken = bundle.tokens[lastPosition];
            uint256 lastId = bundle.ids[lastPosition];
            bundle.tokens[delPosition] = lastToken;
            bundle.ids[delPosition] = lastId;
            bundle.order[lastToken][lastId] = delPosition;
        }
        
        // Remove last position
        bundle.tokens.length--;
        bundle.ids.length--;
        delete bundle.order[token][id];
    }

    function _isAsset(
        Bundle memory bundle,
        uint256 position,
        address token,
        uint256 id
    ) internal pure returns (bool) {
        return position != 0 || 
            (bundle.ids.length != 0 && bundle.tokens[position] == token && bundle.ids[position] == id);
    }
}
