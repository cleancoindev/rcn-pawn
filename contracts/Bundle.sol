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
    Package[] private packages;

    event Deposit(address sender, uint256 package, address token, uint256 id);
    event Withdraw(address retriever, uint256 package, address token, uint256 id);

    struct Package {
        address[] tokens;
        uint256[] ids;
        mapping(address => mapping(uint256 => uint256)) order;
    }

    constructor() public {
        packages.length++;
    }

    modifier canWithdraw(uint256 packageId) {
        require(_isAuthorized(msg.sender, packageId), "Not authorized for withdraw");
        _;
    }

    function canDeposit(uint256 packageId) public view returns (bool) {
        return _isAuthorized(msg.sender, packageId);
    }

    function content(uint256 id) external view returns (address[] tokens, uint256[] ids) {
        Package memory package = packages[id];
        tokens = package.tokens;
        ids = package.ids;
    }

    // create package
    /**
    @notice Create a empty Package in packages array
    */
    function create() public returns (uint256 id) {
        id = packages.length;
        packages.length++;
        _generate(id, msg.sender);
    }

    function deposit(
        uint256 _packageId,
        ERC721 token,
        uint256 tokenId
    ) external returns (bool) {
        uint256 packageId = _packageId == 0 ? create() : _packageId;
        require(canDeposit(packageId), "Not authorized for deposit");
        return _deposit(packageId, token, tokenId);
    }

    function depositBatch(
        uint256 _packageId,
        ERC721[] tokens,
        uint256[] ids
    ) external returns (bool) {
        uint256 packageId = _packageId == 0 ? create() : _packageId;
        require(canDeposit(packageId), "Not authorized for deposit");

        require(tokens.length == ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            require(_deposit(packageId, tokens[i], ids[i]));
        }

        return true;
    }

    function _deposit(
        uint256 packageId,
        ERC721 token,
        uint256 tokenId
    ) internal returns (bool) {
        token.transferFrom(msg.sender, address(this), tokenId);
        require(token.ownerOf(tokenId) == address(this), "ERC721 transfer failed");

        Package storage package = packages[packageId];
        _add(package, token, tokenId);

        emit Deposit(msg.sender, packageId, token, tokenId);

        return true;
    }

    function withdraw(
        uint256 packageId,
        ERC721 token,
        uint256 tokenId,
        address to
    ) public canWithdraw(packageId) {
        Package storage package = packages[packageId];
        _remove(package, token, tokenId);

        emit Withdraw(msg.sender, packageId, token, tokenId);

        token.transferFrom(this, to, tokenId);
        require(token.ownerOf(tokenId) == to, "ERC721 transfer failed");
    }

    function _add(
        Package storage package,
        ERC721 token,
        uint256 id
    ) internal {
        uint256 position = package.order[token][id];
        require(!_isAsset(package, position, token, id), "Already exist");
        position = package.tokens.length;
        package.tokens.push(token);
        package.ids.push(id);
        package.order[token][id] = position;
    }

    function _remove(
        Package storage package,
        ERC721 token,
        uint256 id
    ) internal {
        uint256 delPosition = package.order[token][id];
        require(_isAsset(package, delPosition, token, id), "The token does not exist inside the package");

        // Replace item to remove with last item
        // (make the item to remove the last one)
        uint256 lastPosition = package.tokens.length - 1;
        if (lastPosition != delPosition) {
            address lastToken = package.tokens[lastPosition];
            uint256 lastId = package.ids[lastPosition];
            package.tokens[delPosition] = lastToken;
            package.ids[delPosition] = lastId;
            package.order[lastToken][lastId] = delPosition;
        }

        // Remove last position
        package.tokens.length--;
        package.ids.length--;
        delete package.order[token][id];
    }

    function _isAsset(
        Package memory package,
        uint256 position,
        address token,
        uint256 id
    ) internal pure returns (bool) {
        return position != 0 ||
            (package.ids.length != 0 && package.tokens[position] == token && package.ids[position] == id);
    }
}
